import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useIPC } from './useIPC';

describe('useIPC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('vscode', {
      postMessage: vi.fn(),
    });
  });

  it('sends message to extension', () => {
    const { result } = renderHook(() => useIPC(() => {}));

    act(() => {
      result.current.send({ type: 'session:create' } as never);
    });

    expect(window.vscode.postMessage).toHaveBeenCalledWith({ type: 'session:create' });
  });

  it('registers message event listener', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useIPC(() => {}));

    expect(addEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
  });
});
