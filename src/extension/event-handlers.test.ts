/* eslint-disable @typescript-eslint/unbound-method */
/**
 * @file Unit tests for registerEventHandlers.
 * Verifies SSE event routing, child session created event filtering,
 * child-to-parent request redirection, and status bar integration.
 */

import type { SessionStatus } from '@opencode-ai/sdk/v2/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerEventHandlers } from './event-handlers';
import { IPCBridge } from './ipc';
import { PendingRequestBuffer } from './pending-request-buffer';
import { SessionRelationTracker } from './session-relation-tracker';
import { StatusBarManager } from './status-bar';

describe('Event Handlers SSE Subscription', () => {
  let sseHandlerCallback: ((event: unknown) => void) | undefined;
  const mockUnsubscribeEvents = vi.fn();

  const mockSdk = {
    subscribeEvents: vi.fn((handler: (event: unknown) => void) => {
      sseHandlerCallback = handler;
      return mockUnsubscribeEvents;
    }),
  };

  let mockIpc: IPCBridge;
  let mockPendingBuffer: PendingRequestBuffer;
  let mockSessionStatuses: Map<string, SessionStatus>;
  let mockStatusBarManager: StatusBarManager;
  let mockRelationTracker: SessionRelationTracker;
  const mockSyncMetadata = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    sseHandlerCallback = undefined;

    mockIpc = {
      send: vi.fn(),
    } as unknown as IPCBridge;

    mockPendingBuffer = {
      addPermission: vi.fn(),
      removePermission: vi.fn(),
      addQuestion: vi.fn(),
      removeQuestion: vi.fn(),
    } as unknown as PendingRequestBuffer;

    mockSessionStatuses = new Map<string, SessionStatus>();

    mockStatusBarManager = {
      update: vi.fn(),
    } as unknown as StatusBarManager;

    mockRelationTracker = new SessionRelationTracker();
    mockSyncMetadata.mockReset();
  });

  it('subscribes to SDK SSE events and returns the unsubscribe function', () => {
    const unsubscribe = registerEventHandlers({
      sdk: mockSdk as never,
      ipc: mockIpc,
      pendingBuffer: mockPendingBuffer,
      sessionStatuses: mockSessionStatuses,
      statusBarManager: mockStatusBarManager,
      relationTracker: mockRelationTracker,
      syncMetadata: mockSyncMetadata,
    });

    expect(mockSdk.subscribeEvents).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toBe(mockUnsubscribeEvents);
  });

  it('updates relation tracker on session.created and session.updated', () => {
    registerEventHandlers({
      sdk: mockSdk as never,
      ipc: mockIpc,
      pendingBuffer: mockPendingBuffer,
      sessionStatuses: mockSessionStatuses,
      statusBarManager: mockStatusBarManager,
      relationTracker: mockRelationTracker,
      syncMetadata: mockSyncMetadata,
    });

    expect(sseHandlerCallback).toBeDefined();
    if (sseHandlerCallback) {
      sseHandlerCallback({
        type: 'session.created',
        properties: {
          info: { id: 'session-1', title: 'Main Task' },
        },
      });

      sseHandlerCallback({
        type: 'session.updated',
        properties: {
          info: { id: 'session-2', title: 'Subtask', parentID: 'session-1' },
        },
      });
    }

    expect(mockRelationTracker.titleMap.get('session-1')).toBe('Main Task');
    expect(mockRelationTracker.titleMap.get('session-2')).toBe('Subtask');
    expect(mockRelationTracker.parentMap.get('session-2')).toBe('session-1');
  });

  it('blocks child session.created events from reaching the webview', () => {
    registerEventHandlers({
      sdk: mockSdk as never,
      ipc: mockIpc,
      pendingBuffer: mockPendingBuffer,
      sessionStatuses: mockSessionStatuses,
      statusBarManager: mockStatusBarManager,
      relationTracker: mockRelationTracker,
      syncMetadata: mockSyncMetadata,
    });

    if (sseHandlerCallback) {
      const childEvent = {
        type: 'session.created',
        properties: {
          info: { id: 'child-1', title: 'Subtask', parentID: 'parent-1' },
        },
      };
      sseHandlerCallback(childEvent);

      expect(mockIpc.send).not.toHaveBeenCalled();

      const rootEvent = {
        type: 'session.created',
        properties: {
          info: { id: 'parent-1', title: 'Main Task' },
        },
      };
      sseHandlerCallback(rootEvent);

      expect(mockIpc.send).toHaveBeenCalledWith({
        type: 'event:received',
        event: rootEvent,
      });
    }
  });

  it('redirects sub-agent permission.asked request to root parent and adds subagentTitle', () => {
    registerEventHandlers({
      sdk: mockSdk as never,
      ipc: mockIpc,
      pendingBuffer: mockPendingBuffer,
      sessionStatuses: mockSessionStatuses,
      statusBarManager: mockStatusBarManager,
      relationTracker: mockRelationTracker,
      syncMetadata: mockSyncMetadata,
    });

    mockRelationTracker.titleMap.set('parent-1', 'Main Task');
    mockRelationTracker.titleMap.set('child-1', 'Subtask (@build subagent)');
    mockRelationTracker.parentMap.set('child-1', 'parent-1');

    if (sseHandlerCallback) {
      const askEvent = {
        type: 'permission.asked',
        properties: {
          id: 'perm-1',
          sessionID: 'child-1',
          permission: 'bash',
          metadata: { command: 'npm run test' },
        },
      };
      sseHandlerCallback(askEvent);

      expect(mockPendingBuffer.addPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionID: 'parent-1',
          subagentTitle: 'Subtask (@build subagent)',
        }),
      );

      expect(mockIpc.send).toHaveBeenCalledWith({
        type: 'event:received',
        event: expect.objectContaining({
          type: 'permission.asked',
          properties: expect.objectContaining({
            sessionID: 'parent-1',
            subagentTitle: 'Subtask (@build subagent)',
          }) as unknown,
        }) as unknown,
      });
    }
  });

  it('redirects sub-agent question.asked request to root parent and adds subagentTitle', () => {
    registerEventHandlers({
      sdk: mockSdk as never,
      ipc: mockIpc,
      pendingBuffer: mockPendingBuffer,
      sessionStatuses: mockSessionStatuses,
      statusBarManager: mockStatusBarManager,
      relationTracker: mockRelationTracker,
      syncMetadata: mockSyncMetadata,
    });

    mockRelationTracker.titleMap.set('parent-1', 'Main Task');
    mockRelationTracker.titleMap.set('child-1', 'Subtask (@build subagent)');
    mockRelationTracker.parentMap.set('child-1', 'parent-1');

    if (sseHandlerCallback) {
      const askEvent = {
        type: 'question.asked',
        properties: {
          id: 'question-1',
          sessionID: 'child-1',
          questions: [{ header: 'Confirm', question: 'Run?' }],
        },
      };
      sseHandlerCallback(askEvent);

      expect(mockPendingBuffer.addQuestion).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionID: 'parent-1',
          subagentTitle: 'Subtask (@build subagent)',
        }),
      );

      expect(mockIpc.send).toHaveBeenCalledWith({
        type: 'event:received',
        event: expect.objectContaining({
          type: 'question.asked',
          properties: expect.objectContaining({
            sessionID: 'parent-1',
            subagentTitle: 'Subtask (@build subagent)',
          }) as unknown,
        }) as unknown,
      });
    }
  });

  it('removes permissions from buffer on permission.replied', () => {
    registerEventHandlers({
      sdk: mockSdk as never,
      ipc: mockIpc,
      pendingBuffer: mockPendingBuffer,
      sessionStatuses: mockSessionStatuses,
      statusBarManager: mockStatusBarManager,
      relationTracker: mockRelationTracker,
      syncMetadata: mockSyncMetadata,
    });

    if (sseHandlerCallback) {
      sseHandlerCallback({
        type: 'permission.replied',
        properties: { requestID: 'perm-1' },
      });

      expect(mockPendingBuffer.removePermission).toHaveBeenCalledWith('perm-1');
    }
  });

  it('removes questions from buffer on question.replied or question.rejected', () => {
    registerEventHandlers({
      sdk: mockSdk as never,
      ipc: mockIpc,
      pendingBuffer: mockPendingBuffer,
      sessionStatuses: mockSessionStatuses,
      statusBarManager: mockStatusBarManager,
      relationTracker: mockRelationTracker,
      syncMetadata: mockSyncMetadata,
    });

    if (sseHandlerCallback) {
      sseHandlerCallback({
        type: 'question.replied',
        properties: { requestID: 'q-1' },
      });
      expect(mockPendingBuffer.removeQuestion).toHaveBeenCalledWith('q-1');

      sseHandlerCallback({
        type: 'question.rejected',
        properties: { requestID: 'q-2' },
      });
      expect(mockPendingBuffer.removeQuestion).toHaveBeenCalledWith('q-2');
    }
  });

  it('updates session status mapping and triggers status bar update on session.status', () => {
    registerEventHandlers({
      sdk: mockSdk as never,
      ipc: mockIpc,
      pendingBuffer: mockPendingBuffer,
      sessionStatuses: mockSessionStatuses,
      statusBarManager: mockStatusBarManager,
      relationTracker: mockRelationTracker,
      syncMetadata: mockSyncMetadata,
    });

    if (sseHandlerCallback) {
      const status: SessionStatus = { type: 'busy' };
      sseHandlerCallback({
        type: 'session.status',
        properties: {
          sessionID: 'session-1',
          status,
        },
      });

      expect(mockSessionStatuses.get('session-1')).toBe(status);
      expect(mockStatusBarManager.update).toHaveBeenCalledTimes(1);
    }
  });

  it('clears session status and tracker entries and updates status bar on session.deleted', () => {
    registerEventHandlers({
      sdk: mockSdk as never,
      ipc: mockIpc,
      pendingBuffer: mockPendingBuffer,
      sessionStatuses: mockSessionStatuses,
      statusBarManager: mockStatusBarManager,
      relationTracker: mockRelationTracker,
      syncMetadata: mockSyncMetadata,
    });

    mockSessionStatuses.set('session-1', { type: 'busy' });
    mockRelationTracker.titleMap.set('session-1', 'Main Task');

    if (sseHandlerCallback) {
      sseHandlerCallback({
        type: 'session.deleted',
        properties: {
          info: { id: 'session-1' },
        },
      });

      expect(mockSessionStatuses.has('session-1')).toBe(false);
      expect(mockRelationTracker.titleMap.has('session-1')).toBe(false);
      expect(mockStatusBarManager.update).toHaveBeenCalledTimes(1);
    }
  });

  it('calls syncMetadata on lsp.updated', () => {
    registerEventHandlers({
      sdk: mockSdk as never,
      ipc: mockIpc,
      pendingBuffer: mockPendingBuffer,
      sessionStatuses: mockSessionStatuses,
      statusBarManager: mockStatusBarManager,
      relationTracker: mockRelationTracker,
      syncMetadata: mockSyncMetadata,
    });

    if (sseHandlerCallback) {
      sseHandlerCallback({ type: 'lsp.updated' });
      expect(mockSyncMetadata).toHaveBeenCalledTimes(1);
    }
  });
});
