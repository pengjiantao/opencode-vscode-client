/* eslint-disable @typescript-eslint/unbound-method */
/**
 * @file Unit and regression tests for handleSelectHistory handler.
 * Verifies custom QuickPick, confirmation dialogs, individual and batch operations.
 */

import type { Message, SessionStatus } from '@opencode-ai/sdk/v2/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { window } from 'vscode';
import { createMockSession } from '../test/mocks/sdk';
import { handleSelectHistory, type HistoryQuickPickItem } from './history-handlers';
import type { IPCBridge } from './ipc';
import type { PendingRequestBuffer } from './pending-request-buffer';
import type { SDKClient } from './sdk-client';
import type { SessionManager } from './session-manager';
import type { SessionRelationTracker } from './session-relation-tracker';
import type { SessionStateStore } from './session-state-store';
import type { AgentInfo, ModelInfo } from './types';

describe('history-handlers', () => {
  let mockSessionStateStore: SessionStateStore;
  let mockSessionManager: SessionManager;
  let mockIpc: IPCBridge;
  let syncPendingRequests: ReturnType<typeof vi.fn>;
  let mockSdk: SDKClient;
  let mockSessionStatuses: Map<string, SessionStatus>;
  let mockPendingBuffer: PendingRequestBuffer;
  let mockRelationTracker: SessionRelationTracker;

  const cachedModels: ModelInfo[] = [{ id: 'model-1', name: 'Model 1' }];
  const cachedAgents: AgentInfo[] = [{ id: 'agent-1', name: 'Agent 1' }];

  let acceptCallback: () => Promise<void>;
  let buttonCallback: (button: unknown) => Promise<void>;
  let itemButtonCallback: (e: { item: HistoryQuickPickItem; button: unknown }) => Promise<void>;

  let mockQuickPick: {
    title: string;
    placeholder: string;
    items: HistoryQuickPickItem[];
    buttons: unknown[];
    show: ReturnType<typeof vi.fn>;
    hide: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    selectedItems: HistoryQuickPickItem[];
    onDidAccept: (cb: () => Promise<void>) => { dispose: () => void };
    onDidTriggerButton: (cb: (button: unknown) => Promise<void>) => { dispose: () => void };
    onDidTriggerItemButton: (
      cb: (e: { item: HistoryQuickPickItem; button: unknown }) => Promise<void>,
    ) => { dispose: () => void };
    onDidHide: (cb: () => void) => { dispose: () => void };
  };

  // Helper cast for showQuickPick mock type safety
  const showQuickPickMock = window.showQuickPick as unknown as ReturnType<
    typeof vi.fn<(items: string[], options?: unknown) => Thenable<string | undefined>>
  >;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSdk = {
      session: {
        list: vi.fn(),
        get: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        messages: vi.fn(),
      },
    } as unknown as SDKClient;

    mockSessionStateStore = {
      getOrInitialize: vi.fn().mockReturnValue({
        model: 'model-1',
        agent: 'agent-1',
        modelVariants: { 'model-1': 'default' },
      }),
      delete: vi.fn(),
    } as unknown as SessionStateStore;

    mockSessionManager = {
      create: vi.fn(),
      switch: vi.fn(),
      close: vi.fn(),
      closeAll: vi.fn(),
      archive: vi.fn(),
      getOpenSessionIDs: vi.fn().mockReturnValue([]),
      setOpenSessionIDs: vi.fn().mockResolvedValue(undefined),
      getMessagesAndParts: vi.fn().mockResolvedValue({ messages: [], parts: [] }),
      get activeSessionID() {
        return null;
      },
    } as unknown as SessionManager;

    mockIpc = {
      send: vi.fn(),
    } as unknown as IPCBridge;

    syncPendingRequests = vi.fn();
    mockSessionStatuses = new Map<string, SessionStatus>();
    mockPendingBuffer = {
      removeBySession: vi.fn(),
      clear: vi.fn(),
    } as unknown as PendingRequestBuffer;
    mockRelationTracker = {
      clean: vi.fn(),
      clear: vi.fn(),
    } as unknown as SessionRelationTracker;

    acceptCallback = null as never;
    buttonCallback = null as never;
    itemButtonCallback = null as never;

    mockQuickPick = {
      title: '',
      placeholder: '',
      items: [],
      buttons: [],
      show: vi.fn(),
      hide: vi.fn(),
      dispose: vi.fn(),
      selectedItems: [],
      onDidAccept: vi.fn((cb: () => Promise<void>) => {
        acceptCallback = cb;
        return { dispose: () => {} };
      }),
      onDidTriggerButton: vi.fn((cb: (button: unknown) => Promise<void>) => {
        buttonCallback = cb;
        return { dispose: () => {} };
      }),
      onDidTriggerItemButton: vi.fn(
        (cb: (e: { item: HistoryQuickPickItem; button: unknown }) => Promise<void>) => {
          itemButtonCallback = cb;
          return { dispose: () => {} };
        },
      ),
      onDidHide: vi.fn(() => {
        return { dispose: () => {} };
      }),
    };

    vi.mocked(window.createQuickPick).mockReturnValue(
      mockQuickPick as unknown as ReturnType<typeof window.createQuickPick>,
    );
  });

  describe('handleSelectHistory', () => {
    it('initializes and displays the custom QuickPick UI', async () => {
      const mockSession = createMockSession({ id: 'session-old', title: 'Session 1' });
      vi.mocked(mockSdk.session.list).mockResolvedValue([mockSession]);

      await handleSelectHistory({
        sdk: mockSdk,
        sessionManager: mockSessionManager,
        sessionStateStore: mockSessionStateStore,
        cachedModels,
        cachedAgents,
        ipc: mockIpc,
        syncPendingRequests,
        sessionStatuses: mockSessionStatuses,
        pendingBuffer: mockPendingBuffer,
        relationTracker: mockRelationTracker,
      });

      expect(window.createQuickPick).toHaveBeenCalled();
      expect(mockQuickPick.show).toHaveBeenCalled();
      expect(mockQuickPick.title).toBe('OpenCode Session History');
      expect(mockQuickPick.items.length).toBe(1);
      expect(mockQuickPick.items[0].sessionID).toBe('session-old');
    });

    it('selects and opens a session from the history list', async () => {
      const mockSession = createMockSession({ id: 'session-old', title: 'Session 1' });
      vi.mocked(mockSdk.session.list).mockResolvedValue([mockSession]);

      await handleSelectHistory({
        sdk: mockSdk,
        sessionManager: mockSessionManager,
        sessionStateStore: mockSessionStateStore,
        cachedModels,
        cachedAgents,
        ipc: mockIpc,
        syncPendingRequests,
        sessionStatuses: mockSessionStatuses,
        pendingBuffer: mockPendingBuffer,
        relationTracker: mockRelationTracker,
      });

      // Simulate user selecting the item and accepting
      mockQuickPick.selectedItems = [mockQuickPick.items[0]];
      await acceptCallback();

      expect(mockQuickPick.hide).toHaveBeenCalled();
      expect(mockSessionManager.switch).toHaveBeenCalledWith('session-old');
      expect(mockIpc.send).toHaveBeenCalledWith({
        type: 'session:switched',
        sessionID: 'session-old',
        model: 'model-1',
        agent: 'agent-1',
        modelVariants: { 'model-1': 'default' },
      });
    });

    it('prompts confirmation when archiving an active session', async () => {
      const mockSession = createMockSession({ id: 'session-active', title: 'Active Session' });
      vi.mocked(mockSdk.session.list).mockResolvedValue([mockSession]);
      vi.mocked(mockSessionManager.getOpenSessionIDs).mockReturnValue(['session-active']);
      vi.mocked(showQuickPickMock).mockResolvedValue('Yes');

      await handleSelectHistory({
        sdk: mockSdk,
        sessionManager: mockSessionManager,
        sessionStateStore: mockSessionStateStore,
        cachedModels,
        cachedAgents,
        ipc: mockIpc,
        syncPendingRequests,
        sessionStatuses: mockSessionStatuses,
        pendingBuffer: mockPendingBuffer,
        relationTracker: mockRelationTracker,
      });

      const archiveButton = mockQuickPick.items[0].buttons?.[0];
      expect(archiveButton).toBeDefined();
      if (archiveButton) {
        await itemButtonCallback({
          item: mockQuickPick.items[0],
          button: archiveButton,
        });
      }

      expect(window.showQuickPick).toHaveBeenCalled();
      const lastCallOpen = showQuickPickMock.mock.calls.at(-1);
      expect(lastCallOpen).toBeDefined();
      if (lastCallOpen) {
        expect(lastCallOpen[0]).toEqual(['Yes', 'No']);
        const opts = lastCallOpen[1] as { placeHolder?: string } | undefined;
        expect(opts?.placeHolder).toContain('currently open');
      }
      expect(mockSessionManager.archive).toHaveBeenCalledWith('session-active');
    });

    it('prompts confirmation when archiving a running session', async () => {
      const mockSession = createMockSession({ id: 'session-running', title: 'Running Session' });
      vi.mocked(mockSdk.session.list).mockResolvedValue([mockSession]);
      mockSessionStatuses.set('session-running', { type: 'busy' });
      vi.mocked(showQuickPickMock).mockResolvedValue('Yes');

      await handleSelectHistory({
        sdk: mockSdk,
        sessionManager: mockSessionManager,
        sessionStateStore: mockSessionStateStore,
        cachedModels,
        cachedAgents,
        ipc: mockIpc,
        syncPendingRequests,
        sessionStatuses: mockSessionStatuses,
        pendingBuffer: mockPendingBuffer,
        relationTracker: mockRelationTracker,
      });

      const archiveButton = mockQuickPick.items[0].buttons?.[0];
      expect(archiveButton).toBeDefined();
      if (archiveButton) {
        await itemButtonCallback({
          item: mockQuickPick.items[0],
          button: archiveButton,
        });
      }

      expect(window.showQuickPick).toHaveBeenCalled();
      const lastCallRunning = showQuickPickMock.mock.calls.at(-1);
      expect(lastCallRunning).toBeDefined();
      if (lastCallRunning) {
        expect(lastCallRunning[0]).toEqual(['Yes', 'No']);
        const opts = lastCallRunning[1] as { placeHolder?: string } | undefined;
        expect(opts?.placeHolder).toContain('currently running');
      }
      expect(mockSessionManager.archive).toHaveBeenCalledWith('session-running');
    });

    it('deletes empty sessions via batch title bar button', async () => {
      const emptySession = createMockSession({ id: 'session-empty', title: 'Empty' });
      const filledSession = createMockSession({ id: 'session-filled', title: 'Filled' });

      vi.mocked(mockSdk.session.list).mockResolvedValue([emptySession, filledSession]);
      vi.mocked(mockSdk.session.messages).mockImplementation((id: string) => {
        if (id === 'session-empty') return Promise.resolve([]);
        return Promise.resolve([{ id: 'msg-1' }] as unknown as Message[]);
      });
      vi.mocked(showQuickPickMock).mockResolvedValue('Yes');

      await handleSelectHistory({
        sdk: mockSdk,
        sessionManager: mockSessionManager,
        sessionStateStore: mockSessionStateStore,
        cachedModels,
        cachedAgents,
        ipc: mockIpc,
        syncPendingRequests,
        sessionStatuses: mockSessionStatuses,
        pendingBuffer: mockPendingBuffer,
        relationTracker: mockRelationTracker,
      });

      const deleteEmptyBtn = mockQuickPick.buttons[0];
      await buttonCallback(deleteEmptyBtn);

      expect(mockSdk.session.delete).toHaveBeenCalledWith('session-empty');
      expect(mockSdk.session.delete).not.toHaveBeenCalledWith('session-filled');
    });

    it('archives sessions older than 30 days via batch button', async () => {
      const now = Date.now();
      const oldSession = createMockSession({
        id: 'session-old',
        title: 'Old',
        time: { created: now - 31 * 24 * 60 * 60 * 1000, updated: now - 31 * 24 * 60 * 60 * 1000 },
      });
      const newSession = createMockSession({
        id: 'session-new',
        title: 'New',
        time: { created: now, updated: now },
      });

      vi.mocked(mockSdk.session.list).mockResolvedValue([oldSession, newSession]);
      vi.mocked(showQuickPickMock).mockResolvedValue('Yes');

      await handleSelectHistory({
        sdk: mockSdk,
        sessionManager: mockSessionManager,
        sessionStateStore: mockSessionStateStore,
        cachedModels,
        cachedAgents,
        ipc: mockIpc,
        syncPendingRequests,
        sessionStatuses: mockSessionStatuses,
        pendingBuffer: mockPendingBuffer,
        relationTracker: mockRelationTracker,
      });

      const archiveOldBtn = mockQuickPick.buttons[1];
      await buttonCallback(archiveOldBtn);

      expect(mockSdk.session.update).toHaveBeenCalled();
      const calls = vi.mocked(mockSdk.session.update).mock.calls;
      const updatedIDs = calls.map((c) => c[0]);
      expect(updatedIDs).toContain('session-old');
      expect(updatedIDs).not.toContain('session-new');
    });

    it('toggles visibility of archived sessions in the QuickPick list', async () => {
      const activeSession = createMockSession({ id: 'session-active', title: 'Active' });
      const archivedSession = createMockSession({
        id: 'session-archived',
        title: 'Archived',
        time: { created: Date.now(), updated: Date.now(), archived: Date.now() },
      });

      vi.mocked(mockSdk.session.list).mockResolvedValue([activeSession, archivedSession]);

      await handleSelectHistory({
        sdk: mockSdk,
        sessionManager: mockSessionManager,
        sessionStateStore: mockSessionStateStore,
        cachedModels,
        cachedAgents,
        ipc: mockIpc,
        syncPendingRequests,
        sessionStatuses: mockSessionStatuses,
        pendingBuffer: mockPendingBuffer,
        relationTracker: mockRelationTracker,
      });

      // Initially archived sessions are hidden
      expect(mockQuickPick.items.map((i) => i.sessionID)).toContain('session-active');
      expect(mockQuickPick.items.map((i) => i.sessionID)).not.toContain('session-archived');

      // Click the toggle button (third button)
      const toggleBtn = mockQuickPick.buttons[2];
      await buttonCallback(toggleBtn);

      // Now both sessions are shown
      expect(mockQuickPick.items.map((i) => i.sessionID)).toContain('session-active');
      expect(mockQuickPick.items.map((i) => i.sessionID)).toContain('session-archived');
    });

    it('purges all archived sessions via clean archived batch button', async () => {
      const activeSession = createMockSession({ id: 'session-active', title: 'Active' });
      const archivedSession = createMockSession({
        id: 'session-archived',
        title: 'Archived',
        time: { created: Date.now(), updated: Date.now(), archived: Date.now() },
      });

      vi.mocked(mockSdk.session.list).mockResolvedValue([activeSession, archivedSession]);
      vi.mocked(showQuickPickMock).mockResolvedValue('Yes');

      await handleSelectHistory({
        sdk: mockSdk,
        sessionManager: mockSessionManager,
        sessionStateStore: mockSessionStateStore,
        cachedModels,
        cachedAgents,
        ipc: mockIpc,
        syncPendingRequests,
        sessionStatuses: mockSessionStatuses,
        pendingBuffer: mockPendingBuffer,
        relationTracker: mockRelationTracker,
      });

      const cleanArchivedBtn = mockQuickPick.buttons[3];
      await buttonCallback(cleanArchivedBtn);

      expect(mockSdk.session.delete).toHaveBeenCalledWith('session-archived');
      expect(mockSdk.session.delete).not.toHaveBeenCalledWith('session-active');
    });

    it('archives a closed session without throwing and calls the SDK update directly', async () => {
      const mockSession = createMockSession({ id: 'session-closed', title: 'Closed Session' });
      vi.mocked(mockSdk.session.list).mockResolvedValue([mockSession]);
      vi.mocked(mockSdk.session.get).mockResolvedValue(mockSession);
      vi.mocked(mockSessionManager.getOpenSessionIDs).mockReturnValue([]); // not open!

      await handleSelectHistory({
        sdk: mockSdk,
        sessionManager: mockSessionManager,
        sessionStateStore: mockSessionStateStore,
        cachedModels,
        cachedAgents,
        ipc: mockIpc,
        syncPendingRequests,
        sessionStatuses: mockSessionStatuses,
        pendingBuffer: mockPendingBuffer,
        relationTracker: mockRelationTracker,
      });

      const archiveButton = mockQuickPick.items[0].buttons?.[0];
      expect(archiveButton).toBeDefined();
      if (archiveButton) {
        await itemButtonCallback({
          item: mockQuickPick.items[0],
          button: archiveButton,
        });
      }

      // Should call sessionManager.archive which internally updates closed session on backend
      expect(mockSessionManager.archive).toHaveBeenCalledWith('session-closed');
    });

    it('deletes an individual session and shows a QuickPick confirmation', async () => {
      const mockSession = createMockSession({ id: 'session-to-delete', title: 'To Delete' });
      vi.mocked(mockSdk.session.list).mockResolvedValue([mockSession]);
      vi.mocked(showQuickPickMock).mockResolvedValue('Yes');

      await handleSelectHistory({
        sdk: mockSdk,
        sessionManager: mockSessionManager,
        sessionStateStore: mockSessionStateStore,
        cachedModels,
        cachedAgents,
        ipc: mockIpc,
        syncPendingRequests,
        sessionStatuses: mockSessionStatuses,
        pendingBuffer: mockPendingBuffer,
        relationTracker: mockRelationTracker,
      });

      const deleteButton = mockQuickPick.items[0].buttons?.[1];
      expect(deleteButton).toBeDefined();
      if (deleteButton) {
        await itemButtonCallback({
          item: mockQuickPick.items[0],
          button: deleteButton,
        });
      }

      expect(window.showQuickPick).toHaveBeenCalled();
      const lastCallDelete = showQuickPickMock.mock.calls.at(-1);
      expect(lastCallDelete).toBeDefined();
      if (lastCallDelete) {
        expect(lastCallDelete[0]).toEqual(['Yes', 'No']);
        const opts = lastCallDelete[1] as { placeHolder?: string } | undefined;
        expect(opts?.placeHolder).toContain('permanently delete');
      }
      expect(mockSdk.session.delete).toHaveBeenCalledWith('session-to-delete');
    });

    it('unarchives a session by setting archived to null and updating via the SDK', async () => {
      const archivedSession = createMockSession({
        id: 'session-archived',
        title: 'Archived Session',
        time: { created: Date.now(), updated: Date.now(), archived: Date.now() },
      });
      vi.mocked(mockSdk.session.list).mockResolvedValue([archivedSession]);
      vi.mocked(mockSdk.session.get).mockResolvedValue(archivedSession);

      await handleSelectHistory({
        sdk: mockSdk,
        sessionManager: mockSessionManager,
        sessionStateStore: mockSessionStateStore,
        cachedModels,
        cachedAgents,
        ipc: mockIpc,
        syncPendingRequests,
        sessionStatuses: mockSessionStatuses,
        pendingBuffer: mockPendingBuffer,
        relationTracker: mockRelationTracker,
      });

      // Toggle archived visibility first to make it show up in items list
      const toggleBtn = mockQuickPick.buttons[2];
      await buttonCallback(toggleBtn);

      // Find the unarchive button (the first button on the item when it is archived)
      const unarchiveButton = mockQuickPick.items[0].buttons?.[0];
      expect(unarchiveButton).toBeDefined();
      if (unarchiveButton) {
        await itemButtonCallback({
          item: mockQuickPick.items[0],
          button: unarchiveButton,
        });
      }

      // It should call sdk.session.get and update it with archived: 0
      expect(mockSdk.session.get).toHaveBeenCalledWith('session-archived');
      expect(mockSdk.session.update).toHaveBeenCalled();
      const lastUpdateCall = vi.mocked(mockSdk.session.update).mock.calls.at(-1);
      expect(lastUpdateCall).toBeDefined();
      if (lastUpdateCall) {
        expect(lastUpdateCall[0]).toBe('session-archived');
        const patchObj = lastUpdateCall[1] as { time?: { archived?: number | null } };
        expect(patchObj.time?.archived).toBe(0);
      }
    });

    it('shows an error message when loading sessions fails', async () => {
      vi.mocked(mockSdk.session.list).mockRejectedValue(new Error('Network error'));
      vi.spyOn(window, 'showErrorMessage').mockResolvedValue(undefined);

      await handleSelectHistory({
        sdk: mockSdk,
        sessionManager: mockSessionManager,
        sessionStateStore: mockSessionStateStore,
        cachedModels,
        cachedAgents,
        ipc: mockIpc,
        syncPendingRequests,
        sessionStatuses: mockSessionStatuses,
        pendingBuffer: mockPendingBuffer,
        relationTracker: mockRelationTracker,
      });

      expect(window.showErrorMessage).toHaveBeenCalledWith(
        'Failed to retrieve session history: Network error',
      );
    });
  });
});
