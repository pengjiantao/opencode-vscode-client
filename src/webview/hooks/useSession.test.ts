/**
 * @file Unit tests for useSession — store access and IPC action dispatching.
 */

import type {
  AssistantMessage,
  Event,
  Message,
  Part,
  PermissionRequest,
  Session,
  SessionStatus,
} from '@opencode-ai/sdk/v2/client';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionStore } from '../store/sessionStore';
import { useSession } from './useSession';

describe('useSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('vscode', {
      postMessage: vi.fn(),
    });
    useSessionStore.setState({
      sessions: [],
      activeSessionID: null,
      messages: {},
      parts: {},
      sessionStatus: {},
      pendingPermissions: [],
    });
  });

  it('returns sessions from store', () => {
    const sessions = [{ id: 'session-1', title: 'Test' }] as never;
    useSessionStore.setState({ sessions });

    const { result } = renderHook(() => useSession());
    expect(result.current.sessions).toEqual(sessions);
  });

  it('calls send when createSession is called', () => {
    const { result } = renderHook(() => useSession());

    act(() => {
      result.current.createSession();
    });

    expect(window.vscode.postMessage).toHaveBeenCalledWith({ type: 'session:create' });
  });

  it('calls send when switchSession is called', () => {
    const { result } = renderHook(() => useSession());

    act(() => {
      result.current.switchSession('session-1');
    });

    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'session:switch',
      sessionID: 'session-1',
    });
  });

  it('calls send when closeSession is called', () => {
    const { result } = renderHook(() => useSession());

    act(() => {
      result.current.closeSession('session-1');
    });

    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'session:close',
      sessionID: 'session-1',
    });
  });

  it('calls send when closeAllSessions is called', () => {
    const { result } = renderHook(() => useSession());

    act(() => {
      result.current.closeAllSessions();
    });

    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'session:close-all',
    });
  });

  it('calls send when sendPrompt is called', () => {
    const { result } = renderHook(() => useSession());

    act(() => {
      result.current.sendPrompt('Hello');
    });

    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'prompt:send',
      text: 'Hello',
    });
  });

  it('calls send when switchModel is called', () => {
    const { result } = renderHook(() => useSession());

    act(() => {
      result.current.switchModel('anthropic/claude-3');
    });

    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'model:switch',
      model: 'anthropic/claude-3',
    });
  });

  it('calls send when switchAgent is called', () => {
    const { result } = renderHook(() => useSession());

    act(() => {
      result.current.switchAgent('build');
    });

    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'agent:switch',
      agent: 'build',
    });
  });

  it('calls send when replyPermission is called with boolean', () => {
    const { result } = renderHook(() => useSession());

    act(() => {
      result.current.replyPermission('perm-1', true);
    });

    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'permission:reply',
      permissionID: 'perm-1',
      reply: 'once',
    });
  });

  it('calls send when replyPermission is called with string', () => {
    const { result } = renderHook(() => useSession());

    act(() => {
      result.current.replyPermission('perm-1', 'always');
    });

    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'permission:reply',
      permissionID: 'perm-1',
      reply: 'always',
    });
  });

  describe('handleEvent', () => {
    it('handles session.created event', () => {
      const { result } = renderHook(() => useSession());
      const session = { id: 'session-1', title: 'New Session' } as unknown as Session;

      act(() => {
        result.current.handleEvent({
          type: 'session.created',
          properties: { info: session },
        } as unknown as Event);
      });

      expect(useSessionStore.getState().sessions).toContainEqual(session);
    });

    it('appends delta to existing part text', () => {
      const { result } = renderHook(() => useSession());

      act(() => {
        useSessionStore.setState({
          activeSessionID: 'session-1',
          parts: {
            'msg-1': [{ id: 'part-1', messageID: 'msg-1', text: 'Hello' } as unknown as Part],
          },
        });
      });

      act(() => {
        result.current.handleEvent({
          type: 'message.part.delta',
          properties: {
            messageID: 'msg-1',
            partID: 'part-1',
            field: 'text',
            delta: ' World',
          },
        } as unknown as Event);
      });

      const updatedPart = useSessionStore.getState().parts['msg-1']?.[0] as
        | Record<string, unknown>
        | undefined;
      expect(updatedPart?.text).toBe('Hello World');
    });

    it('handles permission.asked event', () => {
      const { result } = renderHook(() => useSession());
      const permission: PermissionRequest = {
        id: 'perm-1',
        sessionID: 'session-1',
        permission: 'run_command',
        patterns: ['ls'],
        metadata: {},
        always: [],
      };

      act(() => {
        result.current.handleEvent({
          type: 'permission.asked',
          properties: permission,
        } as unknown as Event);
      });

      expect(useSessionStore.getState().pendingPermissions).toContainEqual(permission);
    });

    it('handles session.updated event', () => {
      const { result } = renderHook(() => useSession());
      const initialSession = { id: 'session-1', title: 'Initial Title' } as unknown as Session;
      const updatedSession = { id: 'session-1', title: 'Updated Title' } as unknown as Session;

      act(() => {
        useSessionStore.setState({
          sessions: [initialSession],
        });
      });

      act(() => {
        result.current.handleEvent({
          type: 'session.updated',
          properties: { info: updatedSession },
        } as unknown as Event);
      });

      expect(useSessionStore.getState().sessions).toContainEqual(updatedSession);
      expect(useSessionStore.getState().sessions).not.toContainEqual(initialSession);
    });

    it('handles session.deleted event', () => {
      const { result } = renderHook(() => useSession());
      const session = { id: 'session-1', title: 'New Session' } as unknown as Session;

      act(() => {
        useSessionStore.setState({
          sessions: [session],
        });
      });

      act(() => {
        result.current.handleEvent({
          type: 'session.deleted',
          properties: { info: session },
        } as unknown as Event);
      });

      expect(useSessionStore.getState().sessions).not.toContainEqual(session);
    });

    it('handles message.updated event', () => {
      const { result } = renderHook(() => useSession());
      const message = {
        id: 'msg-1',
        sessionID: 'session-1',
        content: 'hello',
      } as unknown as Message;

      act(() => {
        result.current.handleEvent({
          type: 'message.updated',
          properties: { info: message },
        } as unknown as Event);
      });

      expect(useSessionStore.getState().messages['session-1']).toContainEqual(message);
    });

    it('handles message.part.updated event', () => {
      const { result } = renderHook(() => useSession());
      const part = { id: 'part-1', messageID: 'msg-1', text: 'Completed Part' } as unknown as Part;

      act(() => {
        result.current.handleEvent({
          type: 'message.part.updated',
          properties: { part },
        } as unknown as Event);
      });

      expect(useSessionStore.getState().parts['msg-1']).toContainEqual(part);
    });

    it('handles message.removed event — removes message and subsequent messages from store', () => {
      const { result } = renderHook(() => useSession());

      act(() => {
        useSessionStore.setState({
          messages: {
            'session-1': [
              { id: 'msg-001', sessionID: 'session-1', role: 'user' },
              { id: 'msg-002', sessionID: 'session-1', role: 'assistant' },
              { id: 'msg-003', sessionID: 'session-1', role: 'user' },
            ] as unknown as Message[],
          },
          parts: {
            'msg-001': [{ id: 'part-1', messageID: 'msg-001' }] as unknown as Part[],
            'msg-002': [{ id: 'part-2', messageID: 'msg-002' }] as unknown as Part[],
            'msg-003': [{ id: 'part-3', messageID: 'msg-003' }] as unknown as Part[],
          },
        });
      });

      act(() => {
        result.current.handleEvent({
          type: 'message.removed',
          properties: { sessionID: 'session-1', messageID: 'msg-002' },
        } as unknown as Event);
      });

      const remaining = useSessionStore.getState().messages['session-1'];
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('msg-001');
      expect(useSessionStore.getState().parts['msg-001']).toBeDefined();
      expect(useSessionStore.getState().parts['msg-002']).toBeUndefined();
      expect(useSessionStore.getState().parts['msg-003']).toBeUndefined();
    });

    it('handles message.part.removed event — removes a specific part from a message', () => {
      const { result } = renderHook(() => useSession());

      act(() => {
        useSessionStore.setState({
          parts: {
            'msg-1': [
              { id: 'part-keep', messageID: 'msg-1', text: 'Keep' },
              { id: 'part-remove', messageID: 'msg-1', text: 'Remove' },
            ] as unknown as Part[],
          },
        });
      });

      act(() => {
        result.current.handleEvent({
          type: 'message.part.removed',
          properties: { sessionID: 'session-1', messageID: 'msg-1', partID: 'part-remove' },
        } as unknown as Event);
      });

      expect(useSessionStore.getState().parts['msg-1']).toHaveLength(1);
      expect(useSessionStore.getState().parts['msg-1'][0].id).toBe('part-keep');
    });

    it('handles session.status event', () => {
      const { result } = renderHook(() => useSession());

      act(() => {
        result.current.handleEvent({
          type: 'session.status',
          properties: {
            sessionID: 'session-1',
            status: 'busy' as unknown as SessionStatus,
          },
        } as unknown as Event);
      });

      expect(useSessionStore.getState().sessionStatus['session-1']).toBe('busy');
    });

    it('handles permission.replied event', () => {
      const { result } = renderHook(() => useSession());
      const permission: PermissionRequest = {
        id: 'perm-1',
        sessionID: 'session-1',
        permission: 'run_command',
        patterns: ['ls'],
        metadata: {},
        always: [],
      };

      act(() => {
        useSessionStore.setState({
          pendingPermissions: [permission],
        });
      });

      act(() => {
        result.current.handleEvent({
          type: 'permission.replied',
          properties: { requestID: 'perm-1' },
        } as unknown as Event);
      });

      expect(useSessionStore.getState().pendingPermissions).toEqual([]);
    });

    it('handles session.next.step.ended event by updating the last assistant message', () => {
      const { result } = renderHook(() => useSession());
      const initialMessage = {
        id: 'msg-1',
        sessionID: 'session-1',
        role: 'assistant',
        cost: 0,
        tokens: { input: 0, output: 0 },
      } as unknown as Message;

      act(() => {
        useSessionStore.setState({
          messages: {
            'session-1': [initialMessage],
          },
        });
      });

      act(() => {
        result.current.handleEvent({
          type: 'session.next.step.ended',
          properties: {
            sessionID: 'session-1',
            cost: 0.15,
            tokens: {
              input: 100,
              output: 200,
              reasoning: 50,
              cache: { read: 10, write: 5 },
            },
          },
        } as unknown as Event);
      });

      const updatedMessages = useSessionStore.getState().messages['session-1'] || [];
      expect(updatedMessages.length).toBe(1);
      const updatedMsg = updatedMessages[0] as AssistantMessage;
      expect(updatedMsg.cost).toBe(0.15);
      expect(updatedMsg.tokens).toEqual({
        input: 100,
        output: 200,
        reasoning: 50,
        cache: { read: 10, write: 5 },
      });
    });
  });
});
