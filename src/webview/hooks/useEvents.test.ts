/**
 * @file Unit tests for useEvents — init message and event listener registration.
 */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEvents } from './useEvents';

describe('useEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('vscode', {
      postMessage: vi.fn(),
    });
  });

  it('sends init message on mount', () => {
    renderHook(() => useEvents());

    expect(window.vscode.postMessage).toHaveBeenCalledWith({ type: 'init' });
  });

  it('registers message event listener', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useEvents());

    expect(addEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
  });
});
