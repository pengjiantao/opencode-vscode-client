/* eslint-disable @typescript-eslint/unbound-method */
/**
 * @file Unit tests for handleCreateSession and handleSelectHistory session handlers.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { window, type ExtensionContext } from 'vscode';
import { createMockSession } from '../test/mocks/sdk';
import type { IPCBridge } from './ipc';
import type { SDKClient } from './sdk-client';
import { handleCreateSession, handleSelectHistory } from './session-handlers';
import type { SessionManager } from './session-manager';
import type { SessionStateStore } from './session-state-store';
import type { AgentInfo, ModelInfo } from './types';

describe('session handlers', () => {
  let mockWorkspaceStateStore: Record<string, string[]>;
  let mockWorkspaceState: {
    get: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let mockContext: ExtensionContext;
  let mockSessionStateStore: SessionStateStore;
  let mockSessionManager: SessionManager;
  let mockIpc: IPCBridge;
  let syncPendingRequests: ReturnType<typeof vi.fn>;
  const cachedModels: ModelInfo[] = [{ id: 'model-1', name: 'Model 1' }];
  const cachedAgents: AgentInfo[] = [{ id: 'agent-1', name: 'Agent 1' }];

  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkspaceStateStore = {};
    mockWorkspaceState = {
      get: vi.fn((key: string, defaultValue?: unknown) => {
        return mockWorkspaceStateStore[key] !== undefined
          ? mockWorkspaceStateStore[key]
          : defaultValue;
      }),
      update: vi.fn((key: string, value: string[]) => {
        mockWorkspaceStateStore[key] = value;
        return Promise.resolve();
      }),
    };
    mockContext = {
      workspaceState: mockWorkspaceState,
    } as unknown as ExtensionContext;

    mockSessionStateStore = {
      getOrInitialize: vi.fn().mockReturnValue({
        model: 'model-1',
        agent: 'agent-1',
        modelVariants: { 'model-1': 'default' },
      }),
    } as unknown as SessionStateStore;

    mockSessionManager = {
      create: vi.fn(),
      switch: vi.fn(),
      getMessagesAndParts: vi.fn().mockResolvedValue({ messages: [], parts: [] }),
    } as unknown as SessionManager;

    mockIpc = {
      send: vi.fn(),
    } as unknown as IPCBridge;

    syncPendingRequests = vi.fn();
  });

  describe('handleCreateSession', () => {
    it('creates session and sends IPC messages', async () => {
      const mockSession = createMockSession({ id: 'session-123' });
      vi.mocked(mockSessionManager.create).mockResolvedValue(mockSession);

      await handleCreateSession({
        sessionManager: mockSessionManager,
        context: mockContext,
        sessionStateStore: mockSessionStateStore,
        cachedModels,
        cachedAgents,
        ipc: mockIpc,
        syncPendingRequests,
      });

      expect(mockSessionManager.create).toHaveBeenCalled();
      expect(mockWorkspaceState.update).toHaveBeenCalledWith('openSessionIDs', ['session-123']);
      expect(mockIpc.send).toHaveBeenCalledWith({ type: 'session:created', session: mockSession });
      expect(mockIpc.send).toHaveBeenCalledWith({
        type: 'session:switched',
        sessionID: 'session-123',
        model: 'model-1',
        agent: 'agent-1',
        modelVariants: { 'model-1': 'default' },
      });
      expect(mockIpc.send).toHaveBeenCalledWith({
        type: 'messages:list',
        sessionID: 'session-123',
        messages: [],
        parts: [],
      });
      expect(syncPendingRequests).toHaveBeenCalledWith('session-123');
    });

    it('skips duplicate session ID', async () => {
      const mockSession = createMockSession({ id: 'session-123' });
      vi.mocked(mockSessionManager.create).mockResolvedValue(mockSession);
      mockWorkspaceStateStore['openSessionIDs'] = ['session-123'];

      await handleCreateSession({
        sessionManager: mockSessionManager,
        context: mockContext,
        sessionStateStore: mockSessionStateStore,
        cachedModels,
        cachedAgents,
        ipc: mockIpc,
        syncPendingRequests,
      });

      expect(mockWorkspaceState.update).not.toHaveBeenCalled();
    });

    it('sends error on failure', async () => {
      vi.mocked(mockSessionManager.create).mockRejectedValue(new Error('Failed to create session'));

      await handleCreateSession({
        sessionManager: mockSessionManager,
        context: mockContext,
        sessionStateStore: mockSessionStateStore,
        cachedModels,
        cachedAgents,
        ipc: mockIpc,
        syncPendingRequests,
      });

      expect(mockIpc.send).toHaveBeenCalledWith({
        type: 'error',
        message: 'Failed to create session',
      });
      expect(syncPendingRequests).not.toHaveBeenCalled();
    });
  });

  describe('handleSelectHistory', () => {
    let mockSdk: SDKClient;

    beforeEach(() => {
      mockSdk = {
        session: {
          list: vi.fn(),
        },
      } as unknown as SDKClient;
    });

    it('shows info when no sessions', async () => {
      vi.mocked(mockSdk.session.list).mockResolvedValue([]);

      await handleSelectHistory({
        sdk: mockSdk,
        sessionManager: mockSessionManager,
        context: mockContext,
        sessionStateStore: mockSessionStateStore,
        cachedModels,
        cachedAgents,
        ipc: mockIpc,
        syncPendingRequests,
      });

      expect(window.showInformationMessage).toHaveBeenCalledWith('No previous sessions found.');
      expect(window.showQuickPick).not.toHaveBeenCalled();
    });

    it('returns early on cancel', async () => {
      const mockSessions = [createMockSession({ id: 'session-old' })];
      vi.mocked(mockSdk.session.list).mockResolvedValue(mockSessions);
      vi.mocked(window.showQuickPick).mockResolvedValue(undefined);

      await handleSelectHistory({
        sdk: mockSdk,
        sessionManager: mockSessionManager,
        context: mockContext,
        sessionStateStore: mockSessionStateStore,
        cachedModels,
        cachedAgents,
        ipc: mockIpc,
        syncPendingRequests,
      });

      expect(window.showQuickPick).toHaveBeenCalled();
      expect(mockSessionManager.switch).not.toHaveBeenCalled();
    });

    it('selects and switches', async () => {
      const mockSession = createMockSession({ id: 'session-old' });
      vi.mocked(mockSdk.session.list).mockResolvedValue([mockSession]);
      vi.mocked(window.showQuickPick).mockResolvedValue({
        label: 'Untitled',
        description: 'description',
        sessionID: 'session-old',
        session: mockSession,
      } as never);

      mockWorkspaceStateStore['openSessionIDs'] = ['session-old'];

      await handleSelectHistory({
        sdk: mockSdk,
        sessionManager: mockSessionManager,
        context: mockContext,
        sessionStateStore: mockSessionStateStore,
        cachedModels,
        cachedAgents,
        ipc: mockIpc,
        syncPendingRequests,
      });

      expect(mockSessionManager.switch).toHaveBeenCalledWith('session-old');
      expect(mockIpc.send).toHaveBeenCalledWith({
        type: 'session:switched',
        sessionID: 'session-old',
        model: 'model-1',
        agent: 'agent-1',
        modelVariants: { 'model-1': 'default' },
      });
      expect(mockIpc.send).toHaveBeenCalledWith({
        type: 'messages:list',
        sessionID: 'session-old',
        messages: [],
        parts: [],
      });
      expect(syncPendingRequests).toHaveBeenCalledWith('session-old');
    });

    it('sends session:created for new ID', async () => {
      const mockSession = createMockSession({ id: 'session-old' });
      vi.mocked(mockSdk.session.list).mockResolvedValue([mockSession]);
      vi.mocked(window.showQuickPick).mockResolvedValue({
        label: 'Untitled',
        description: 'description',
        sessionID: 'session-old',
        session: mockSession,
      } as never);

      mockWorkspaceStateStore['openSessionIDs'] = [];

      await handleSelectHistory({
        sdk: mockSdk,
        sessionManager: mockSessionManager,
        context: mockContext,
        sessionStateStore: mockSessionStateStore,
        cachedModels,
        cachedAgents,
        ipc: mockIpc,
        syncPendingRequests,
      });

      expect(mockWorkspaceState.update).toHaveBeenCalledWith('openSessionIDs', ['session-old']);
      expect(mockIpc.send).toHaveBeenCalledWith({
        type: 'session:created',
        session: mockSession,
      });
    });

    it('shows error on failure', async () => {
      vi.mocked(mockSdk.session.list).mockRejectedValue(new Error('Fetch failed'));

      await handleSelectHistory({
        sdk: mockSdk,
        sessionManager: mockSessionManager,
        context: mockContext,
        sessionStateStore: mockSessionStateStore,
        cachedModels,
        cachedAgents,
        ipc: mockIpc,
        syncPendingRequests,
      });

      expect(window.showErrorMessage).toHaveBeenCalledWith(
        'Failed to retrieve session history: Fetch failed',
      );
    });
  });
});
