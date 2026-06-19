/**
 * @file Unit tests for extension activation and native VS Code Status Bar Item integration.
 * Tests status bar lifecycle management, status state mapping, memory leak prevention (disposables),
 * and dynamic rendering based on session state transitions.
 */

import type { SessionStatus } from '@opencode-ai/sdk/v2/client';
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { ExtensionContext, StatusBarItem } from 'vscode';
import { window } from 'vscode';
import { activate } from './index';
import { SessionManager, type SessionManagerState } from './session-manager';

// Define typed mocks for SDKClient events subscription
let sseHandlerCallback: ((event: unknown) => void) | undefined;
const mockUnsubscribeEvents = vi.fn();

const mockSdk = {
  startServer: vi.fn().mockResolvedValue({ url: 'http://localhost:3000', close: vi.fn() }),
  session: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({
      id: 'session-1',
      title: 'Untitled',
      time: { created: Date.now(), updated: Date.now() },
    }),
    messages: vi.fn().mockResolvedValue([]),
    messagesWithParts: vi.fn().mockResolvedValue([]),
    statusAll: vi.fn().mockResolvedValue({}),
  },
  subscribeEvents: vi.fn((handler: (event: unknown) => void) => {
    sseHandlerCallback = handler;
    return mockUnsubscribeEvents;
  }),
  permission: {
    reply: vi.fn().mockResolvedValue(undefined),
  },
  lsp: {
    status: vi.fn().mockResolvedValue([]),
  },
  mcp: {
    status: vi.fn().mockResolvedValue({}),
  },
  config: {
    get: vi.fn().mockResolvedValue({ plugin: [] }),
  },
  getSkills: vi.fn().mockResolvedValue([]),
  getCommands: vi.fn().mockResolvedValue([]),
  getModels: vi.fn().mockResolvedValue([]),
  getAgents: vi.fn().mockResolvedValue([]),
};

vi.mock('./sdk-client-impl', () => ({
  createSDKClient: vi.fn(() => mockSdk),
}));

// Map to track active IPC event handler registration for test injection
const ipcHandlers = new Map<string, (msg?: unknown) => void | Promise<void>>();
const mockIpcSend = vi.fn();

vi.mock('./ipc', () => {
  return {
    IPCBridge: vi.fn().mockImplementation(() => ({
      on: vi.fn((event: string, handler: (msg?: unknown) => void) => {
        ipcHandlers.set(event, handler);
      }),
      send: (...args: unknown[]) => {
        mockIpcSend(...args);
      },
    })),
  };
});

vi.mock('./webview-provider', () => {
  return {
    OpencodeSidebarViewProvider: vi.fn().mockImplementation(() => ({
      view: undefined,
    })),
  };
});

// opencodeBinary pre-flight + recovery prompt: mocked at the test-suite level
// so existing tests (which assume a happy path) get a successful resolution.
// Tests that need to exercise the not-found / spawn-failure paths override
// the per-test mock implementations below.
type ResolvedBinary = {
  path: string | null;
  source: 'config' | 'path' | 'none';
  reason?: 'not-in-path' | 'config-invalid' | 'config-not-executable';
  configuredPath?: string;
};
const mockResolveOpencodeBinary = vi.fn(
  (): ResolvedBinary => ({ path: '/mock/opencode', source: 'path' }),
);
const mockShowOpencodeNotFoundPrompt = vi.fn().mockResolvedValue(undefined);

vi.mock('./utils/opencode-path', async (importOriginal) => {
  // Preserve the real `deriveReasonFromError` (pure, side-effect free) so the
  // activation catch block can use it to map spawn errors to NotFoundReason.
  // We only mock `resolveOpencodeBinary` because that's what the pre-flight
  // check calls, and individual tests override it per-case.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const actual = (await importOriginal()) as Record<string, unknown>;
  const result: Record<string, unknown> = { ...actual };
  result['resolveOpencodeBinary'] = (...args: unknown[]) =>
    (mockResolveOpencodeBinary as (...a: unknown[]) => unknown)(...args);
  return result;
});

vi.mock('./utils/opencode-prompt', () => ({
  showOpencodeNotFoundPrompt: (...args: unknown[]) =>
    (mockShowOpencodeNotFoundPrompt as (...a: unknown[]) => unknown)(...args),
}));

describe('Extension Status Bar Activation', () => {
  let mockContext: ExtensionContext;
  let mockStatusBarItem: StatusBarItem;
  let activeSessionListener: ((state: SessionManagerState) => void) | undefined;
  const mockUnsubscribeActiveSession = vi.fn();
  let mockWorkspaceStateStore: Map<string, unknown>;
  let activeSessionIDSpy: MockInstance<() => string | null> | undefined;

  beforeEach(() => {
    if (activeSessionIDSpy) {
      activeSessionIDSpy.mockRestore();
      activeSessionIDSpy = undefined;
    }
    vi.clearAllMocks();
    ipcHandlers.clear();
    sseHandlerCallback = undefined;
    activeSessionListener = undefined;
    mockWorkspaceStateStore = new Map<string, unknown>();
    mockWorkspaceStateStore.set('openSessionIDs', []);

    // Spy and intercept SessionManager active session subscription
    vi.spyOn(SessionManager.prototype, 'subscribe').mockImplementation((listener) => {
      activeSessionListener = listener;
      return mockUnsubscribeActiveSession;
    });

    // Mock Context workspace state and subscription containers
    mockContext = {
      subscriptions: [],
      workspaceState: {
        get: vi.fn((key: string, defaultValue?: unknown) => {
          return mockWorkspaceStateStore.has(key) ? mockWorkspaceStateStore.get(key) : defaultValue;
        }),
        update: vi.fn((key: string, value: unknown) => {
          mockWorkspaceStateStore.set(key, value);
          return Promise.resolve();
        }),
      },
      globalState: {
        get: vi.fn().mockReturnValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
      } as never,
      extensionPath: '/test',
      asAbsolutePath: vi.fn(),
      storagePath: '/test-storage',
      globalStoragePath: '/test-global-storage',
      logPath: '/test-log',
    } as unknown as ExtensionContext;

    // Trigger actived status bar mock item capturing
    mockStatusBarItem = window.createStatusBarItem(1, 100);
    vi.mocked(window.createStatusBarItem).mockClear();
    vi.mocked(window.createStatusBarItem).mockReturnValue(mockStatusBarItem);
  });

  it('registers status bar item and subscriptions to context.subscriptions (disposable checks)', async () => {
    await activate(mockContext);

    // Verify native VS Code status bar creation (called twice for status and close all)
    expect(window.createStatusBarItem).toHaveBeenCalledTimes(2);

    // Verify disposables are pushed to context.subscriptions (Memory Leak Prevention)
    expect(mockContext.subscriptions).toContain(mockStatusBarItem);
    expect(mockContext.subscriptions).toContainEqual({ dispose: mockUnsubscribeActiveSession });
    expect(mockContext.subscriptions).toContainEqual({ dispose: mockUnsubscribeEvents });
  });

  it('updates status bar correctly based on session status events', async () => {
    await activate(mockContext);

    // Force initialization of activeSessionID
    activeSessionIDSpy = vi
      .spyOn(SessionManager.prototype, 'activeSessionID', 'get')
      .mockReturnValue('session-1');

    // Simulate switching active session to trigger render check
    if (activeSessionListener) {
      activeSessionListener({ activeSessionID: 'session-1' });
    }

    // 1. Verify "Ready" / Default Idle state
    expect(mockStatusBarItem.text).toBe('$(circle-outline) OpenCode: Ready');
    expect(mockStatusBarItem.tooltip).toContain('Status: Ready');

    // 2. Simulate SSE "busy" processing status event
    if (sseHandlerCallback) {
      sseHandlerCallback({
        type: 'session.status',
        properties: {
          sessionID: 'session-1',
          status: { type: 'busy' } as SessionStatus,
        },
      });
    }

    expect(mockStatusBarItem.text).toBe('$(sync~spin) OpenCode: Processing...');
    expect(mockStatusBarItem.tooltip).toContain('Status: Processing');

    // 3. Simulate SSE "retry" processing status event
    if (sseHandlerCallback) {
      sseHandlerCallback({
        type: 'session.status',
        properties: {
          sessionID: 'session-1',
          status: { type: 'retry', attempt: 3, next: 5, message: 'Timeout error' } as SessionStatus,
        },
      });
    }

    expect(mockStatusBarItem.text).toBe('$(warning) OpenCode: Retrying (3/5)');
    expect(mockStatusBarItem.tooltip).toContain('Status: Retrying...');
    expect(mockStatusBarItem.tooltip).toContain('Message: Timeout error');
    expect(mockStatusBarItem.backgroundColor).toBeDefined();
  });

  it('cleans up status bar on active session changes or empty session state', async () => {
    await activate(mockContext);

    // Simulate active session being null (no open session)
    activeSessionIDSpy = vi
      .spyOn(SessionManager.prototype, 'activeSessionID', 'get')
      .mockReturnValue(null);
    if (activeSessionListener) {
      activeSessionListener({ activeSessionID: null });
    }

    // Expect status bar item to be hidden
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockStatusBarItem.hide).toHaveBeenCalled();
  });

  it('clears status entries from map on close, archive, close-all, and SSE deleted events', async () => {
    await activate(mockContext);

    // Setup active session status in the internal map
    activeSessionIDSpy = vi
      .spyOn(SessionManager.prototype, 'activeSessionID', 'get')
      .mockReturnValue('session-1');
    if (sseHandlerCallback) {
      sseHandlerCallback({
        type: 'session.status',
        properties: {
          sessionID: 'session-1',
          status: { type: 'busy' } as SessionStatus,
        },
      });
    }
    expect(mockStatusBarItem.text).toBe('$(sync~spin) OpenCode: Processing...');

    // 1. Simulate SSE 'session.deleted' event
    if (sseHandlerCallback) {
      sseHandlerCallback({
        type: 'session.deleted',
        properties: {
          info: { id: 'session-1' },
        },
      });
    }

    // Status map is cleared, active status falls back to Ready
    expect(mockStatusBarItem.text).toBe('$(circle-outline) OpenCode: Ready');

    // 2. Set status back to busy and close session via IPC
    if (sseHandlerCallback) {
      sseHandlerCallback({
        type: 'session.status',
        properties: {
          sessionID: 'session-1',
          status: { type: 'busy' } as SessionStatus,
        },
      });
    }
    expect(mockStatusBarItem.text).toBe('$(sync~spin) OpenCode: Processing...');

    const closeHandler = ipcHandlers.get('session:close');
    expect(closeHandler).toBeDefined();
    if (closeHandler) {
      void closeHandler({ sessionID: 'session-1' });
    }

    // Active session status falls back to Ready as the map entry is deleted
    if (activeSessionListener) {
      activeSessionListener({ activeSessionID: 'session-1' });
    }
    expect(mockStatusBarItem.text).toBe('$(circle-outline) OpenCode: Ready');

    // 3. Set status back to busy and close all sessions via IPC
    if (sseHandlerCallback) {
      sseHandlerCallback({
        type: 'session.status',
        properties: {
          sessionID: 'session-1',
          status: { type: 'busy' } as SessionStatus,
        },
      });
    }
    expect(mockStatusBarItem.text).toBe('$(sync~spin) OpenCode: Processing...');

    const closeAllHandler = ipcHandlers.get('session:close-all');
    expect(closeAllHandler).toBeDefined();
    if (closeAllHandler) {
      void closeAllHandler();
    }

    if (activeSessionListener) {
      activeSessionListener({ activeSessionID: 'session-1' });
    }
    expect(mockStatusBarItem.text).toBe('$(circle-outline) OpenCode: Ready');
  });

  describe('Session state persistence regression tests', () => {
    it('restores the activeSessionID on init if it is in openSessionIDs', async () => {
      mockWorkspaceStateStore.set('openSessionIDs', ['session-1', 'session-2']);
      mockWorkspaceStateStore.set('activeSessionID', 'session-2');

      await activate(mockContext);

      const mockSessions = [
        { id: 'session-1', title: 'Session 1', time: { created: Date.now(), updated: Date.now() } },
        { id: 'session-2', title: 'Session 2', time: { created: Date.now(), updated: Date.now() } },
      ];
      vi.mocked(mockSdk.session.list).mockResolvedValue(mockSessions);

      const initHandler = ipcHandlers.get('init');
      expect(initHandler).toBeDefined();
      if (initHandler) {
        await initHandler();
      }

      expect(mockWorkspaceStateStore.get('activeSessionID')).toBe('session-2');
      expect(mockIpcSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session:switched',
          sessionID: 'session-2',
        }),
      );
    });

    it('falls back to the first open session if activeSessionID is not in openSessionIDs', async () => {
      mockWorkspaceStateStore.set('openSessionIDs', ['session-1', 'session-2']);
      mockWorkspaceStateStore.set('activeSessionID', 'session-nonexistent');

      await activate(mockContext);

      const mockSessions = [
        { id: 'session-1', title: 'Session 1', time: { created: Date.now(), updated: Date.now() } },
        { id: 'session-2', title: 'Session 2', time: { created: Date.now(), updated: Date.now() } },
      ];
      vi.mocked(mockSdk.session.list).mockResolvedValue(mockSessions);

      const initHandler = ipcHandlers.get('init');
      expect(initHandler).toBeDefined();
      if (initHandler) {
        await initHandler();
      }

      expect(mockWorkspaceStateStore.get('activeSessionID')).toBe('session-1');
    });

    it('updates activeSessionID on session:switch', async () => {
      mockWorkspaceStateStore.set('openSessionIDs', ['session-1', 'session-2']);
      mockWorkspaceStateStore.set('activeSessionID', 'session-1');

      await activate(mockContext);

      const mockSessions = [
        { id: 'session-1', title: 'Session 1', time: { created: Date.now(), updated: Date.now() } },
        { id: 'session-2', title: 'Session 2', time: { created: Date.now(), updated: Date.now() } },
      ];
      vi.mocked(mockSdk.session.list).mockResolvedValue(mockSessions);

      const initHandler = ipcHandlers.get('init');
      if (initHandler) {
        await initHandler();
      }

      const switchHandler = ipcHandlers.get('session:switch');
      expect(switchHandler).toBeDefined();
      if (switchHandler) {
        await switchHandler({ sessionID: 'session-2' });
      }

      expect(mockWorkspaceStateStore.get('activeSessionID')).toBe('session-2');
    });

    it('updates activeSessionID on session:close of active session', async () => {
      mockWorkspaceStateStore.set('openSessionIDs', ['session-1', 'session-2']);
      mockWorkspaceStateStore.set('activeSessionID', 'session-2');

      await activate(mockContext);

      const mockSessions = [
        { id: 'session-1', title: 'Session 1', time: { created: Date.now(), updated: Date.now() } },
        { id: 'session-2', title: 'Session 2', time: { created: Date.now(), updated: Date.now() } },
      ];
      vi.mocked(mockSdk.session.list).mockResolvedValue(mockSessions);

      const initHandler = ipcHandlers.get('init');
      if (initHandler) {
        await initHandler();
      }

      expect(mockWorkspaceStateStore.get('activeSessionID')).toBe('session-2');

      const closeHandler = ipcHandlers.get('session:close');
      expect(closeHandler).toBeDefined();
      if (closeHandler) {
        await closeHandler({ sessionID: 'session-2' });
      }

      expect(mockWorkspaceStateStore.get('openSessionIDs')).toEqual(['session-1']);
      expect(mockWorkspaceStateStore.get('activeSessionID')).toBe('session-1');
    });

    it('clears activeSessionID when all sessions are closed', async () => {
      mockWorkspaceStateStore.set('openSessionIDs', ['session-1']);
      mockWorkspaceStateStore.set('activeSessionID', 'session-1');

      await activate(mockContext);

      const mockSessions = [
        { id: 'session-1', title: 'Session 1', time: { created: Date.now(), updated: Date.now() } },
      ];
      vi.mocked(mockSdk.session.list).mockResolvedValue(mockSessions);

      const initHandler = ipcHandlers.get('init');
      if (initHandler) {
        await initHandler();
      }

      const newSession = {
        id: 'session-new',
        title: 'Untitled',
        time: { created: Date.now(), updated: Date.now() },
      };
      vi.mocked(mockSdk.session.create).mockResolvedValue(newSession);

      const closeHandler = ipcHandlers.get('session:close');
      expect(closeHandler).toBeDefined();
      if (closeHandler) {
        await closeHandler({ sessionID: 'session-1' });
      }

      expect(mockWorkspaceStateStore.get('openSessionIDs')).toEqual(['session-new']);
      expect(mockWorkspaceStateStore.get('activeSessionID')).toBe('session-new');
    });

    it('restores the active session status on init from sessionStatuses', async () => {
      mockWorkspaceStateStore.set('openSessionIDs', ['session-1', 'session-2']);
      mockWorkspaceStateStore.set('activeSessionID', 'session-2');

      await activate(mockContext);

      const mockSessions = [
        { id: 'session-1', title: 'Session 1', time: { created: Date.now(), updated: Date.now() } },
        { id: 'session-2', title: 'Session 2', time: { created: Date.now(), updated: Date.now() } },
      ];
      vi.mocked(mockSdk.session.list).mockResolvedValue(mockSessions);

      const session2Status = { type: 'busy' } as SessionStatus;
      if (sseHandlerCallback) {
        sseHandlerCallback({
          type: 'session.status',
          properties: {
            sessionID: 'session-2',
            status: session2Status,
          },
        });
      }

      const initHandler = ipcHandlers.get('init');
      expect(initHandler).toBeDefined();
      if (initHandler) {
        await initHandler();
      }

      expect(mockIpcSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'messages:list',
          sessionID: 'session-2',
          status: session2Status,
        }),
      );
    });

    it('restores the active session status on session:switch from sessionStatuses', async () => {
      mockWorkspaceStateStore.set('openSessionIDs', ['session-1', 'session-2']);
      mockWorkspaceStateStore.set('activeSessionID', 'session-1');

      await activate(mockContext);

      const mockSessions = [
        { id: 'session-1', title: 'Session 1', time: { created: Date.now(), updated: Date.now() } },
        { id: 'session-2', title: 'Session 2', time: { created: Date.now(), updated: Date.now() } },
      ];
      vi.mocked(mockSdk.session.list).mockResolvedValue(mockSessions);

      const initHandler = ipcHandlers.get('init');
      if (initHandler) {
        await initHandler();
      }

      const session2Status = { type: 'busy' } as SessionStatus;
      if (sseHandlerCallback) {
        sseHandlerCallback({
          type: 'session.status',
          properties: {
            sessionID: 'session-2',
            status: session2Status,
          },
        });
      }

      const switchHandler = ipcHandlers.get('session:switch');
      expect(switchHandler).toBeDefined();
      if (switchHandler) {
        await switchHandler({ sessionID: 'session-2' });
      }

      expect(mockIpcSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'messages:list',
          sessionID: 'session-2',
          status: session2Status,
        }),
      );
    });

    it('seeds sessionStatuses from sdk.session.statusAll and broadcasts a bulk snapshot on init', async () => {
      // Regression: previously the in-memory sessionStatuses map was empty after
      // an extension restart, so busy sessions on non-active tabs were only
      // recovered when the next SSE event arrived. The fix queries the backend
      // once during activate() and emits session:statuses-bulk during init.
      mockWorkspaceStateStore.set('openSessionIDs', ['session-1', 'session-2']);
      mockWorkspaceStateStore.set('activeSessionID', 'session-2');

      const session1Busy = { type: 'busy' } as SessionStatus;
      const session2Idle = { type: 'idle' } as SessionStatus;
      vi.mocked(mockSdk.session.statusAll).mockResolvedValue({
        'session-1': session1Busy,
        'session-2': session2Idle,
      });

      await activate(mockContext);

      const mockSessions = [
        { id: 'session-1', title: 'Session 1', time: { created: Date.now(), updated: Date.now() } },
        { id: 'session-2', title: 'Session 2', time: { created: Date.now(), updated: Date.now() } },
      ];
      vi.mocked(mockSdk.session.list).mockResolvedValue(mockSessions);

      const initHandler = ipcHandlers.get('init');
      expect(initHandler).toBeDefined();
      if (initHandler) {
        await initHandler();
      }

      // Backend was queried at startup to seed the in-memory status map.
      expect(mockSdk.session.statusAll).toHaveBeenCalled();

      // The webview receives a single bulk snapshot covering every known session,
      // not just the active one. This is the message that lets the SessionTabs
      // component render a running spinner on inactive tabs.
      expect(mockIpcSend).toHaveBeenCalledWith({
        type: 'session:statuses-bulk',
        statuses: {
          'session-1': session1Busy,
          'session-2': session2Idle,
        },
      });
    });

    it('preserves the order of openSessionIDs on init even if sdk.session.list returns them in desc/reverse order', async () => {
      // openSessionIDs order is 1 -> 2 -> 3 (oldest to newest)
      mockWorkspaceStateStore.set('openSessionIDs', ['session-1', 'session-2', 'session-3']);
      mockWorkspaceStateStore.set('activeSessionID', 'session-3');

      await activate(mockContext);

      // Backend returns them in desc order (3 -> 2 -> 1)
      const mockSessions = [
        {
          id: 'session-3',
          title: 'Session 3',
          time: { created: Date.now() + 2, updated: Date.now() + 2 },
        },
        {
          id: 'session-2',
          title: 'Session 2',
          time: { created: Date.now() + 1, updated: Date.now() + 1 },
        },
        { id: 'session-1', title: 'Session 1', time: { created: Date.now(), updated: Date.now() } },
      ];
      vi.mocked(mockSdk.session.list).mockResolvedValue(mockSessions);

      const initHandler = ipcHandlers.get('init');
      expect(initHandler).toBeDefined();
      if (initHandler) {
        await initHandler();
      }

      // Verify that the init message contains sessions in the correct order: [session-1, session-2, session-3]
      expect(mockIpcSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'init',
          sessions: [
            expect.objectContaining({ id: 'session-1' }),
            expect.objectContaining({ id: 'session-2' }),
            expect.objectContaining({ id: 'session-3' }),
          ],
        }),
      );
    });

    it('auto-creates a new session on init when activeSessionID is stale and server returns no sessions', async () => {
      // Regression: on Windows, the path normalization bug in sdk-client caused
      // sdk.session.list() to return an empty array even when sessions existed
      // on the server. When workspaceState had a stale activeSessionID, the
      // init handler would try to switch to that non-existent session, throw
      // a "Session not found" error that was silently caught, and never create
      // a new session — leaving the webview with no active session.
      // The fix: reset stale activeSessionID to null so the auto-create path
      // can trigger.
      mockWorkspaceStateStore.set('openSessionIDs', ['stale-session-id']);
      mockWorkspaceStateStore.set('activeSessionID', 'stale-session-id');

      const newSession = {
        id: 'new-session',
        title: 'Untitled',
        time: { created: Date.now(), updated: Date.now() },
      };
      vi.mocked(mockSdk.session.create).mockResolvedValue(newSession);
      vi.mocked(mockSdk.session.list).mockResolvedValue([]);

      await activate(mockContext);

      const initHandler = ipcHandlers.get('init');
      expect(initHandler).toBeDefined();
      if (initHandler) {
        await initHandler();
      }

      // The stale activeSessionID should be reset and auto-create triggered.
      expect(mockSdk.session.create).toHaveBeenCalledTimes(1);

      // The webview should receive the init message with the new session.
      expect(mockIpcSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'init',
          sessions: [expect.objectContaining({ id: 'new-session' })],
        }),
      );

      // The webview should be switched to the new session.
      expect(mockIpcSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session:switched',
          sessionID: 'new-session',
        }),
      );

      // The new session should be persisted as active.
      expect(mockWorkspaceStateStore.get('activeSessionID')).toBe('new-session');
    });
  });

  describe('opencode binary resolution', () => {
    // Most of the suite uses the default happy-path mock for the binary
    // resolver; these tests need to control its return value per-test, so we
    // re-apply the mock before each run.
    beforeEach(() => {
      mockResolveOpencodeBinary.mockReset();
      mockShowOpencodeNotFoundPrompt.mockClear();
    });

    it('aborts activation with a friendly prompt when the opencode binary cannot be found', async () => {
      // Regression: previously the outer try/catch surfaced the raw
      // "spawn opencode ENOENT" error from the SDK, leaving the user with a
      // cryptic toast and no recovery path. The fix is a pre-flight check
      // that resolves the binary BEFORE creating the SDK client and shows a
      // user-friendly notification with actionable buttons.
      mockResolveOpencodeBinary.mockReturnValueOnce({
        path: null,
        source: 'none',
        reason: 'not-in-path',
      });

      await activate(mockContext);

      expect(mockShowOpencodeNotFoundPrompt).toHaveBeenCalledTimes(1);
      const [resolvedArg] = mockShowOpencodeNotFoundPrompt.mock.calls[0] as [
        { source: string; reason: string },
      ];
      expect(resolvedArg.source).toBe('none');
      expect(resolvedArg.reason).toBe('not-in-path');

      // The SDK client must never be created when the binary is missing —
      // otherwise the next code path would still try to spawn and crash with
      // the original raw error.
      expect(mockSdk.startServer).not.toHaveBeenCalled();
    });

    it('aborts activation with the configured path when opencode.executablePath is invalid', async () => {
      // Regression: a user who sets opencode.executablePath to a non-existent
      // file should see a prompt tailored to that scenario (not the generic
      // "not in PATH" message).
      mockResolveOpencodeBinary.mockReturnValueOnce({
        path: null,
        source: 'none',
        reason: 'config-invalid',
        configuredPath: '/wrong/path/opencode',
      });

      await activate(mockContext);

      expect(mockShowOpencodeNotFoundPrompt).toHaveBeenCalledTimes(1);
      const [resolvedArg] = mockShowOpencodeNotFoundPrompt.mock.calls[0] as [
        { reason: string; configuredPath: string },
      ];
      expect(resolvedArg.reason).toBe('config-invalid');
      expect(resolvedArg.configuredPath).toBe('/wrong/path/opencode');
    });

    it('translates a runtime spawn failure into the friendly prompt', async () => {
      // Regression: even when the pre-flight check passes, the SDK can still
      // fail to spawn the server (race condition, the binary on PATH was
      // removed between pre-flight and connect, EACCES, etc.). The activation
      // catch block must distinguish spawn-time failures from generic errors
      // and route them through the same recovery flow.
      mockResolveOpencodeBinary.mockReturnValueOnce({
        path: '/mock/opencode',
        source: 'path',
      });
      const spawnError = new Error('spawn opencode ENOENT');
      vi.mocked(mockSdk.startServer).mockRejectedValueOnce(spawnError);

      await activate(mockContext);

      expect(mockShowOpencodeNotFoundPrompt).toHaveBeenCalledTimes(1);
      const [resolvedArg, errArg] = mockShowOpencodeNotFoundPrompt.mock.calls[0] as [
        { source: string; reason: string },
        unknown,
      ];
      expect(resolvedArg.source).toBe('none');
      // PATH-sourced binary + ENOENT → user genuinely has no opencode on PATH.
      expect(resolvedArg.reason).toBe('not-in-path');
      expect(errArg).toBe(spawnError);
    });

    it('derives config-not-executable when EACCES hits a configured path', async () => {
      // Regression: previously the activation catch block synthesised a
      // not-in-path reason regardless of the spawn error, which made the
      // recovery prompt misleading for users with a valid-but-unexecutable
      // configured path. Now the reason is derived from the error message
      // AND the pre-flight source, so an EACCES on a configured file tells
      // the user "is not executable" instead of "not in PATH".
      mockResolveOpencodeBinary.mockReturnValueOnce({
        path: '/home/user/bin/opencode',
        source: 'config',
      });
      const eaccesError = new Error('spawn /home/user/bin/opencode EACCES');
      vi.mocked(mockSdk.startServer).mockRejectedValueOnce(eaccesError);

      await activate(mockContext);

      const [resolvedArg] = mockShowOpencodeNotFoundPrompt.mock.calls[0] as [
        { source: string; reason: string; configuredPath?: string },
      ];
      expect(resolvedArg.source).toBe('none');
      expect(resolvedArg.reason).toBe('config-not-executable');
      // The configured path is threaded through so the message can quote it.
      expect(resolvedArg.configuredPath).toBe('/home/user/bin/opencode');
    });

    it('derives config-invalid when ENOENT hits a configured path', async () => {
      // Regression: the file existed at pre-flight but disappeared before
      // the spawn (e.g. a sync tool removed it). Saying "not in PATH" would
      // be wrong — the file was configured, not PATH-sourced.
      mockResolveOpencodeBinary.mockReturnValueOnce({
        path: '/home/user/bin/opencode',
        source: 'config',
      });
      const enoentError = new Error('spawn /home/user/bin/opencode ENOENT');
      vi.mocked(mockSdk.startServer).mockRejectedValueOnce(enoentError);

      await activate(mockContext);

      const [resolvedArg] = mockShowOpencodeNotFoundPrompt.mock.calls[0] as [
        { source: string; reason: string; configuredPath?: string },
      ];
      expect(resolvedArg.source).toBe('none');
      expect(resolvedArg.reason).toBe('config-invalid');
      expect(resolvedArg.configuredPath).toBe('/home/user/bin/opencode');
    });

    it('falls back to the generic activation-failed toast for non-spawn errors', async () => {
      // Regression: not every activation failure is a binary issue. A
      // programming error (e.g. an SDK method throwing an unexpected error)
      // must still surface as the original "OpenCode Sidebar activation
      // failed" notification so users can see the underlying message.
      mockResolveOpencodeBinary.mockReturnValueOnce({
        path: '/mock/opencode',
        source: 'path',
      });
      const genericError = new Error('Something else went wrong');
      vi.mocked(mockSdk.startServer).mockRejectedValueOnce(genericError);

      await activate(mockContext);

      expect(mockShowOpencodeNotFoundPrompt).not.toHaveBeenCalled();
      expect(window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('OpenCode Sidebar activation failed'),
      );
    });

    it('passes the resolved binary path through to createSDKClient', async () => {
      // Regression: when the binary resolves from configuration (non-default
      // path), the resolved path must propagate to the SDK client so it can
      // adjust PATH for the spawn. Otherwise the SDK would try to launch the
      // bare 'opencode' name and fail to find the configured file.
      const { createSDKClient } = await import('./sdk-client-impl');
      mockResolveOpencodeBinary.mockReturnValueOnce({
        path: '/custom/bin/opencode',
        source: 'config',
      });

      await activate(mockContext);

      expect(createSDKClient).toHaveBeenCalledWith(
        expect.objectContaining({ opencodeBinaryPath: '/custom/bin/opencode' }),
      );
    });
  });
});
