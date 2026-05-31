/* eslint-disable @typescript-eslint/unbound-method */
/**
 * @file Unit tests for handleCreateSession and handleSelectHistory session handlers.
 */

import type { SessionStatus } from '@opencode-ai/sdk/v2/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockSession } from '../test/mocks/sdk';
import type { IPCBridge } from './ipc';
import type { PendingRequestBuffer } from './pending-request-buffer';
import type { SDKClient } from './sdk-client';
import { handleCreateSession, registerSessionLifecycleHandlers } from './session-handlers';
import type { SessionManager } from './session-manager';
import type { SessionRelationTracker } from './session-relation-tracker';
import type { SessionStateStore } from './session-state-store';
import type { AgentInfo, ModelInfo } from './types';

describe('session handlers', () => {
  let mockSessionStateStore: SessionStateStore;
  let mockSessionManager: SessionManager;
  let mockIpc: IPCBridge;
  let syncPendingRequests: ReturnType<typeof vi.fn>;
  let mockSdk: SDKClient;
  const cachedModels: ModelInfo[] = [{ id: 'model-1', name: 'Model 1' }];
  const cachedAgents: AgentInfo[] = [{ id: 'agent-1', name: 'Agent 1' }];

  beforeEach(() => {
    vi.clearAllMocks();

    mockSdk = {
      session: {
        list: vi.fn(),
        get: vi.fn(),
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
  });

  describe('handleCreateSession', () => {
    it('creates session and sends IPC messages', async () => {
      const mockSession = createMockSession({ id: 'session-123' });
      vi.mocked(mockSessionManager.create).mockResolvedValue(mockSession);

      await handleCreateSession({
        sessionManager: mockSessionManager,
        sessionStateStore: mockSessionStateStore,
        cachedModels,
        cachedAgents,
        ipc: mockIpc,
        syncPendingRequests,
      });

      expect(mockSessionManager.create).toHaveBeenCalled();
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

    it('sends error on failure', async () => {
      vi.mocked(mockSessionManager.create).mockRejectedValue(new Error('Failed to create session'));

      await handleCreateSession({
        sessionManager: mockSessionManager,
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

  describe('registerSessionLifecycleHandlers', () => {
    let handlers: Map<string, (msg?: unknown) => void | Promise<void>>;
    let mockSessionStatuses: Map<string, SessionStatus>;
    let mockPendingBuffer: PendingRequestBuffer;
    let mockRelationTracker: SessionRelationTracker;
    let mockInvokeCloseAllSessions: ReturnType<typeof vi.fn>;
    let mockSyncMetadata: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      handlers = new Map();
      mockIpc = {
        on: vi.fn((event: string, handler: (msg?: unknown) => void) => {
          handlers.set(event, handler);
        }),
        send: vi.fn(),
      } as unknown as IPCBridge;

      mockSessionStatuses = new Map();
      mockPendingBuffer = {
        removeBySession: vi.fn(),
        clear: vi.fn(),
      } as unknown as PendingRequestBuffer;

      mockRelationTracker = {
        clean: vi.fn(),
        clear: vi.fn(),
        parentMap: new Map(),
      } as unknown as SessionRelationTracker;

      mockInvokeCloseAllSessions = vi.fn();
      mockSyncMetadata = vi.fn();

      registerSessionLifecycleHandlers({
        sdk: mockSdk,
        ipc: mockIpc,
        sessionManager: mockSessionManager,
        sessionStateStore: mockSessionStateStore,
        getCachedModels: () => cachedModels,
        getCachedAgents: () => cachedAgents,
        syncMetadata: mockSyncMetadata,
        syncPendingRequests,
        sessionStatuses: mockSessionStatuses,
        pendingBuffer: mockPendingBuffer,
        relationTracker: mockRelationTracker,
        invokeCloseAllSessions: mockInvokeCloseAllSessions,
        fetchedDiffSessions: new Set(),
      });
    });

    it('handles session:switch', async () => {
      const switchHandler = handlers.get('session:switch');
      expect(switchHandler).toBeDefined();

      mockSessionStatuses.set('session-2', { type: 'busy' });
      vi.mocked(mockSessionManager.getOpenSessionIDs).mockReturnValue(['session-2']);

      if (switchHandler) {
        await switchHandler({ sessionID: 'session-2' });
      }

      expect(mockSessionManager.switch).toHaveBeenCalledWith('session-2');
      expect(mockIpc.send).toHaveBeenCalledWith({
        type: 'session:switched',
        sessionID: 'session-2',
        model: 'model-1',
        agent: 'agent-1',
        modelVariants: { 'model-1': 'default' },
      });
      expect(mockIpc.send).toHaveBeenCalledWith({
        type: 'messages:list',
        sessionID: 'session-2',
        messages: [],
        parts: [],
        status: { type: 'busy' },
      });
      expect(mockSyncMetadata).toHaveBeenCalled();
      expect(syncPendingRequests).toHaveBeenCalledWith('session-2');
    });

    it('handles session:switch when child session is not in openIDs and SDK load succeeds', async () => {
      const switchHandler = handlers.get('session:switch');
      expect(switchHandler).toBeDefined();

      vi.mocked(mockSessionManager.getOpenSessionIDs).mockReturnValue(['session-1']);
      const mockSession = createMockSession({ id: 'child-session-id' });
      vi.mocked(mockSdk.session.get).mockResolvedValue(mockSession);

      if (switchHandler) {
        await switchHandler({ sessionID: 'child-session-id' });
      }

      expect(mockSdk.session.get).toHaveBeenCalledWith('child-session-id');
      expect(mockSessionManager.setOpenSessionIDs).toHaveBeenCalledWith([
        'session-1',
        'child-session-id',
      ]);
      expect(mockIpc.send).toHaveBeenCalledWith({
        type: 'session:created',
        session: mockSession,
      });
      expect(mockSessionManager.switch).toHaveBeenCalledWith('child-session-id');
    });

    it('handles session:switch when child session is not in openIDs and SDK load fails', async () => {
      const switchHandler = handlers.get('session:switch');
      expect(switchHandler).toBeDefined();

      vi.mocked(mockSessionManager.getOpenSessionIDs).mockReturnValue(['session-1']);
      vi.mocked(mockSdk.session.get).mockRejectedValue(new Error('SDK load error'));

      if (switchHandler) {
        await switchHandler({ sessionID: 'child-session-id' });
      }

      expect(mockSdk.session.get).toHaveBeenCalledWith('child-session-id');
      expect(mockSessionManager.switch).not.toHaveBeenCalledWith('child-session-id');
      expect(mockIpc.send).toHaveBeenCalledWith({
        type: 'error',
        message: 'Failed to load child session: SDK load error',
      });
    });

    it('handles session:archive and falls back to create session if no open sessions left', async () => {
      const archiveHandler = handlers.get('session:archive');
      expect(archiveHandler).toBeDefined();

      vi.spyOn(mockSessionManager, 'activeSessionID', 'get').mockReturnValue('session-1');
      vi.mocked(mockSessionManager.getOpenSessionIDs).mockReturnValue([]);
      vi.mocked(mockSessionManager.create).mockResolvedValue(
        createMockSession({ id: 'fallback-session' }),
      );

      if (archiveHandler) {
        await archiveHandler({ sessionID: 'session-1' });
      }

      expect(mockSessionManager.archive).toHaveBeenCalledWith('session-1');
      expect(mockIpc.send).toHaveBeenCalledWith({
        type: 'session:archived',
        sessionID: 'session-1',
      });
      expect(mockSessionManager.create).toHaveBeenCalled();
    });

    it('handles session:archive and switches to next open session if active is archived', async () => {
      const archiveHandler = handlers.get('session:archive');
      expect(archiveHandler).toBeDefined();

      vi.spyOn(mockSessionManager, 'activeSessionID', 'get').mockReturnValue('session-2');
      vi.mocked(mockSessionManager.getOpenSessionIDs).mockReturnValue(['session-2']);

      if (archiveHandler) {
        await archiveHandler({ sessionID: 'session-1' });
      }

      expect(mockSessionManager.archive).toHaveBeenCalledWith('session-1');
      expect(mockIpc.send).toHaveBeenCalledWith({
        type: 'session:archived',
        sessionID: 'session-1',
      });
      expect(mockSessionManager.switch).not.toHaveBeenCalled();
    });

    it('handles session:close and creates a fallback session if no open sessions left', async () => {
      const closeHandler = handlers.get('session:close');
      expect(closeHandler).toBeDefined();

      vi.mocked(mockSessionManager.getOpenSessionIDs).mockReturnValue([]);
      vi.mocked(mockSessionManager.create).mockResolvedValue(
        createMockSession({ id: 'fallback-session' }),
      );
      vi.spyOn(mockSessionManager, 'activeSessionID', 'get').mockReturnValue('session-1');

      if (closeHandler) {
        await closeHandler({ sessionID: 'session-1' });
      }

      expect(mockSessionManager.close).toHaveBeenCalledWith('session-1');
      expect(mockIpc.send).toHaveBeenCalledWith({
        type: 'session:deleted',
        sessionID: 'session-1',
      });
      expect(mockSessionManager.create).toHaveBeenCalled();
    });

    it('handles session:close-all', async () => {
      const closeAllHandler = handlers.get('session:close-all');
      expect(closeAllHandler).toBeDefined();

      if (closeAllHandler) {
        await closeAllHandler();
      }

      expect(mockInvokeCloseAllSessions).toHaveBeenCalled();
    });
  });

  describe('session:load-child-messages', () => {
    let handlers: Map<string, (msg?: unknown) => void | Promise<void>>;
    let mockSessionStatuses: Map<string, SessionStatus>;
    let mockPendingBuffer: PendingRequestBuffer;
    let mockRelationTracker: SessionRelationTracker;
    let mockInvokeCloseAllSessions: ReturnType<typeof vi.fn>;
    let mockSyncMetadata: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      handlers = new Map();
      mockIpc = {
        on: vi.fn((event: string, handler: (msg?: unknown) => void) => {
          handlers.set(event, handler);
        }),
        send: vi.fn(),
      } as unknown as IPCBridge;

      mockSessionStatuses = new Map();
      mockPendingBuffer = {
        removeBySession: vi.fn(),
        clear: vi.fn(),
      } as unknown as PendingRequestBuffer;

      mockRelationTracker = {
        clean: vi.fn(),
        clear: vi.fn(),
        parentMap: new Map(),
      } as unknown as SessionRelationTracker;

      mockInvokeCloseAllSessions = vi.fn();
      mockSyncMetadata = vi.fn();

      registerSessionLifecycleHandlers({
        sdk: mockSdk,
        ipc: mockIpc,
        sessionManager: mockSessionManager,
        sessionStateStore: mockSessionStateStore,
        getCachedModels: () => cachedModels,
        getCachedAgents: () => cachedAgents,
        syncMetadata: mockSyncMetadata,
        syncPendingRequests,
        sessionStatuses: mockSessionStatuses,
        pendingBuffer: mockPendingBuffer,
        relationTracker: mockRelationTracker,
        invokeCloseAllSessions: mockInvokeCloseAllSessions,
        fetchedDiffSessions: new Set(),
      });
    });

    it('loads child session messages without recursion', async () => {
      const handler = handlers.get('session:load-child-messages');
      expect(handler).toBeDefined();

      vi.mocked(mockSessionManager.getMessagesAndParts).mockResolvedValue({
        messages: [
          { id: 'msg-child', role: 'assistant', sessionID: 'child-1' },
        ] as unknown as import('@opencode-ai/sdk/v2/client').Message[],
        parts: [
          { id: 'part-1', messageID: 'msg-child', type: 'text', text: 'output' },
        ] as unknown as import('@opencode-ai/sdk/v2/client').Part[],
      });
      vi.mocked(mockSdk.session.get).mockResolvedValue(createMockSession({ id: 'child-1' }));

      if (handler) {
        await handler({ sessionID: 'child-1' });
      }

      expect(mockSdk.session.get).toHaveBeenCalledWith('child-1');
      expect(mockSessionManager.getMessagesAndParts).toHaveBeenCalledWith('child-1');
      expect(mockIpc.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'messages:child-loaded',
          sessionID: 'child-1',
        }),
      );
    });

    it('silently ignores non-existent child session', async () => {
      const handler = handlers.get('session:load-child-messages');
      expect(handler).toBeDefined();

      vi.mocked(mockSdk.session.get).mockRejectedValue(new Error('Not found'));

      if (handler) {
        await handler({ sessionID: 'non-existent' });
      }

      expect(mockSessionManager.getMessagesAndParts).not.toHaveBeenCalled();
      expect(mockIpc.send).not.toHaveBeenCalled();
    });
  });
});
