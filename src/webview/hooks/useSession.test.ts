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
      pendingPermission: null,
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

  it('calls send when replyPermission is called', () => {
    const { result } = renderHook(() => useSession());

    act(() => {
      result.current.replyPermission('perm-1', true);
    });

    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'permission:reply',
      permissionID: 'perm-1',
      allow: true,
    });
  });
});
