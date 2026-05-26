/* eslint-disable @typescript-eslint/unbound-method */
/**
 * @file Unit tests for StatusBarManager.
 * Verifies that the status indicator and Close All buttons are created and updated.
 */

import type { SessionStatus } from '@opencode-ai/sdk/v2/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtensionContext } from 'vscode';
import { StatusBarAlignment, window, type StatusBarItem } from 'vscode';
import type { SessionManager } from './session-manager';
import { StatusBarManager } from './status-bar';

interface MockSessionManager {
  activeSessionID: string | null;
  getOpenSessionIDs: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
}

describe('StatusBarManager', () => {
  let mockContext: ExtensionContext;
  let mockSessionManager: MockSessionManager;
  let mockSessionStatuses: Map<string, SessionStatus>;
  let mockUnsubscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = {
      subscriptions: [],
    } as unknown as ExtensionContext;

    mockUnsubscribe = vi.fn();
    mockSessionManager = {
      activeSessionID: 'test-session',
      getOpenSessionIDs: vi.fn().mockReturnValue(['test-session']),
      subscribe: vi.fn().mockReturnValue(mockUnsubscribe),
    };

    mockSessionStatuses = new Map<string, SessionStatus>();
  });

  it('registers status bar items and subscribes to session changes on creation', () => {
    new StatusBarManager(
      mockContext,
      mockSessionManager as unknown as SessionManager,
      mockSessionStatuses,
    );

    expect(window.createStatusBarItem).toHaveBeenCalledWith(StatusBarAlignment.Right, 100);
    expect(window.createStatusBarItem).toHaveBeenCalledWith(StatusBarAlignment.Right, 99);
    expect(mockContext.subscriptions.length).toBe(3); // 2 status bar items + 1 subscription disposable
    expect(mockSessionManager.subscribe).toHaveBeenCalled();
  });

  it('hides all status bar items if activeSessionID is null', () => {
    mockSessionManager.activeSessionID = null;

    const manager = new StatusBarManager(
      mockContext,
      mockSessionManager as unknown as SessionManager,
      mockSessionStatuses,
    );

    const mockCreateStatusBarItem = vi.mocked(window.createStatusBarItem);
    const firstItem = mockCreateStatusBarItem.mock.results[0].value as unknown as StatusBarItem;
    const secondItem = mockCreateStatusBarItem.mock.results[1].value as unknown as StatusBarItem;

    manager.update();

    expect(firstItem.hide).toHaveBeenCalled();
    expect(secondItem.hide).toHaveBeenCalled();
  });

  it('shows Close All button if there are open sessions', () => {
    const manager = new StatusBarManager(
      mockContext,
      mockSessionManager as unknown as SessionManager,
      mockSessionStatuses,
    );

    const mockCreateStatusBarItem = vi.mocked(window.createStatusBarItem);
    const secondItem = mockCreateStatusBarItem.mock.results[1].value as unknown as StatusBarItem;

    manager.update();

    expect(secondItem.show).toHaveBeenCalled();
    expect(secondItem.text).toBe('$(close-all) Close All');
  });

  it('hides Close All button if there are no open sessions', () => {
    mockSessionManager.getOpenSessionIDs.mockReturnValue([]);

    const manager = new StatusBarManager(
      mockContext,
      mockSessionManager as unknown as SessionManager,
      mockSessionStatuses,
    );

    const mockCreateStatusBarItem = vi.mocked(window.createStatusBarItem);
    const secondItem = mockCreateStatusBarItem.mock.results[1].value as unknown as StatusBarItem;

    manager.update();

    expect(secondItem.hide).toHaveBeenCalled();
  });
});
