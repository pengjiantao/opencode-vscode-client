/**
 * @file Unit tests for extension activation and native VS Code Status Bar Item integration.
 * Tests status bar lifecycle management, status state mapping, memory leak prevention (disposables),
 * and dynamic rendering based on session state transitions.
 */

import type { SessionStatus } from '@opencode-ai/sdk/v2/client';
import * as fs from 'fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtensionContext, StatusBarItem, TextDocument, TextEditor } from 'vscode';
import { Uri, window, workspace } from 'vscode';
import { activate } from './index';
import { SessionManager, type SessionManagerState } from './session-manager';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
  readFileSync: vi.fn(),
  promises: {
    stat: vi.fn(),
    readFile: vi.fn(),
  },
}));

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
  },
  subscribeEvents: vi.fn((handler: (event: unknown) => void) => {
    sseHandlerCallback = handler;
    return mockUnsubscribeEvents;
  }),
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

describe('Extension Status Bar Activation', () => {
  let mockContext: ExtensionContext;
  let mockStatusBarItem: StatusBarItem;
  let activeSessionListener: ((state: SessionManagerState) => void) | undefined;
  const mockUnsubscribeActiveSession = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    ipcHandlers.clear();
    sseHandlerCallback = undefined;
    activeSessionListener = undefined;

    // Spy and intercept SessionManager active session subscription
    vi.spyOn(SessionManager.prototype, 'subscribe').mockImplementation((listener) => {
      activeSessionListener = listener;
      return mockUnsubscribeActiveSession;
    });

    // Mock Context workspace state and subscription containers
    mockContext = {
      subscriptions: [],
      workspaceState: {
        get: vi.fn().mockReturnValue([]),
        update: vi.fn().mockResolvedValue(undefined),
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

    // Verify native VS Code status bar creation
    expect(window.createStatusBarItem).toHaveBeenCalledTimes(1);

    // Verify disposables are pushed to context.subscriptions (Memory Leak Prevention)
    expect(mockContext.subscriptions).toContain(mockStatusBarItem);
    expect(mockContext.subscriptions).toContainEqual({ dispose: mockUnsubscribeActiveSession });
    expect(mockContext.subscriptions).toContainEqual({ dispose: mockUnsubscribeEvents });
  });

  it('updates status bar correctly based on session status events', async () => {
    await activate(mockContext);

    // Force initialization of activeSessionID
    vi.spyOn(SessionManager.prototype, 'activeSessionID', 'get').mockReturnValue('session-1');

    // Simulate switching active session to trigger render check
    if (activeSessionListener) {
      activeSessionListener({ activeSessionID: 'session-1', sessions: [], isConnected: true });
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
    vi.spyOn(SessionManager.prototype, 'activeSessionID', 'get').mockReturnValue(null);
    if (activeSessionListener) {
      activeSessionListener({ activeSessionID: null, sessions: [], isConnected: true });
    }

    // Expect status bar item to be hidden
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockStatusBarItem.hide).toHaveBeenCalled();
  });

  it('clears status entries from map on close, archive, close-all, and SSE deleted events', async () => {
    await activate(mockContext);

    // Setup active session status in the internal map
    vi.spyOn(SessionManager.prototype, 'activeSessionID', 'get').mockReturnValue('session-1');
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
      activeSessionListener({ activeSessionID: 'session-1', sessions: [], isConnected: true });
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
      activeSessionListener({ activeSessionID: 'session-1', sessions: [], isConnected: true });
    }
    expect(mockStatusBarItem.text).toBe('$(circle-outline) OpenCode: Ready');
  });

  it('regression: handles file:open and file:query IPC events correctly', async () => {
    await activate(mockContext);

    // Test file:open handler
    const openHandler = ipcHandlers.get('file:open');
    expect(openHandler).toBeDefined();

    const mockDoc = {};
    vi.spyOn(workspace, 'getWorkspaceFolder').mockReturnValue({
      uri: { fsPath: '/some', path: '/some', scheme: 'file' } as unknown as Uri,
      name: 'workspace',
      index: 0,
    });
    const openTextDocumentSpy = vi
      .spyOn(workspace, 'openTextDocument')
      .mockResolvedValue(mockDoc as unknown as TextDocument);
    vi.spyOn(window, 'showTextDocument').mockResolvedValue(undefined as unknown as TextEditor);

    if (openHandler) {
      void openHandler({ path: '/some/file.txt' });
    }

    expect(openTextDocumentSpy).toHaveBeenCalled();

    // Test file:query handler
    const queryHandler = ipcHandlers.get('file:query');
    expect(queryHandler).toBeDefined();

    vi.mocked(fs.promises.stat).mockResolvedValue({
      isFile: () => true,
      size: 1024,
    } as unknown as fs.Stats);
    vi.mocked(fs.promises.readFile).mockResolvedValue(Buffer.from('File content'));

    if (queryHandler) {
      void queryHandler({ path: '/some/file.txt' });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    expect(fs.promises.stat).toHaveBeenCalledWith('/some/file.txt');
    expect(mockIpcSend).toHaveBeenCalledWith({
      type: 'file:query-response',
      path: '/some/file.txt',
      exists: true,
      filename: 'file.txt',
      size: 1024,
      content: 'File content',
      isWorkspace: true,
    });
  });
});
