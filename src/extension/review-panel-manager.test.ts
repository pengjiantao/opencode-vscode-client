/**
 * @file Unit tests for the ReviewPanelManager class.
 * Tests panel creation, tracking, disposal, and multi-panel support.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createReviewID } from '../webview/utils/review-utils';
import { ReviewPanelManager } from './review-panel-manager';

const mockDispose = vi.fn();
const mockReveal = vi.fn();
const mockOnDidDispose = vi.fn();
const mockPostMessage = vi.fn();
const mockOnDidReceiveMessage = vi.fn();

const createMockPanel = () => ({
  webview: {
    postMessage: mockPostMessage,
    onDidReceiveMessage: mockOnDidReceiveMessage,
    asWebviewUri: vi.fn(() => ({ toString: () => 'vscode-webview://test' })),
    cspSource: 'vscode-webview://test',
    html: '',
  },
  dispose: mockDispose,
  reveal: mockReveal,
  onDidDispose: mockOnDidDispose,
  onDidChangeViewState: vi.fn(),
  viewColumn: 1,
  active: true,
  visible: true,
});

vi.mock('vscode', () => ({
  window: {
    createWebviewPanel: vi.fn(() => createMockPanel()),
  },
  ViewColumn: { One: 1 },
  Uri: {
    joinPath: vi.fn(() => ({ toString: () => 'vscode-webview://test' })),
    file: vi.fn((path: string) => ({ toString: () => path })),
  },
}));

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
    readFileSync: vi.fn(() => '<html></html>'),
  },
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() => '<html></html>'),
}));

describe('ReviewPanelManager', () => {
  let manager: ReviewPanelManager;
  const mockContext = {
    extensionUri: {},
    extensionPath: '/ext',
  } as unknown as import('vscode').ExtensionContext;
  const mockSdk = {
    session: {
      diff: vi.fn().mockResolvedValue([
        {
          file: 'test.ts',
          additions: 5,
          deletions: 2,
          status: 'modified',
          patch: '--- a\n+++ b\n@@ -1 +1 @@\n-old\n+new',
        },
      ]),
    },
  } as unknown as import('./sdk-client').SDKClient;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new ReviewPanelManager(mockContext, mockSdk);
  });

  it('creates a new panel on first open', async () => {
    const { window } = await import('vscode');
    await manager.open('review-1', 'session-1', undefined, 'Review Changes');
    expect(window.createWebviewPanel).toHaveBeenCalledWith(
      'opencode-review.review-1',
      'Review Changes',
      1,
      expect.objectContaining({ enableScripts: true }),
    );
  });

  it('sends review:data after fetching diffs', async () => {
    await manager.open('review-1', 'session-1', undefined, 'Review Changes');
    // Verify review:data was sent via postMessage
    const calls = mockPostMessage.mock.calls as Array<[Record<string, unknown>]>;
    const reviewDataCall = calls.find((c) => c[0]?.type === 'review:data');
    expect(reviewDataCall).toBeDefined();
    const data = reviewDataCall![0];
    expect(data.type).toBe('review:data');
    expect(data.reviewID).toBe('review-1');
    expect(Array.isArray(data.diffs)).toBe(true);
  });

  it('reveals existing panel instead of creating duplicate', async () => {
    const { window } = await import('vscode');
    await manager.open('review-1', 'session-1', undefined, 'Review Changes');
    await manager.open('review-1', 'session-1', undefined, 'Review Changes');
    // createWebviewPanel should only be called once
    expect(window.createWebviewPanel).toHaveBeenCalledTimes(1);
    // reveal should be called on the second open
    expect(mockReveal).toHaveBeenCalled();
  });

  it('creates separate panels for different reviewIDs', async () => {
    const { window } = await import('vscode');
    await manager.open('review-1', 'session-1', undefined, 'Review 1');
    await manager.open('review-2', 'session-1', undefined, 'Review 2');
    expect(window.createWebviewPanel).toHaveBeenCalledTimes(2);
  });

  // Regression: clicking the same "summary" button multiple times used to open
  // a new review tab on every click because createReviewID() appended a
  // Date.now() suffix, defeating the dedup key in ReviewPanelManager.open().
  // The ID is now stable, so repeat clicks must reuse (reveal) the existing
  // panel and only create a new one for a genuinely different summary target.
  it('dedupes repeated opens of the same summary target (regression for Date.now() in reviewID)', async () => {
    const { window } = await import('vscode');

    // Same turn-scope button clicked twice (per-message summary).
    const turnID = createReviewID('sess-A', 'turn', 'msg-1');
    await manager.open(turnID, 'sess-A', 'msg-1', 'Review Changes');
    await manager.open(turnID, 'sess-A', 'msg-1', 'Review Changes');
    expect(window.createWebviewPanel).toHaveBeenCalledTimes(1);
    expect(mockReveal).toHaveBeenCalledTimes(1);

    // Same session-scope button clicked twice (input-box summary).
    const sessionID = createReviewID('sess-A', 'session');
    await manager.open(sessionID, 'sess-A', undefined, 'Review Changes');
    await manager.open(sessionID, 'sess-A', undefined, 'Review Changes');
    expect(window.createWebviewPanel).toHaveBeenCalledTimes(2);
    expect(mockReveal).toHaveBeenCalledTimes(2);

    // A different message of the same session must still get its own tab.
    const otherTurnID = createReviewID('sess-A', 'turn', 'msg-2');
    expect(otherTurnID).not.toBe(turnID);
    await manager.open(otherTurnID, 'sess-A', 'msg-2', 'Review Changes');
    expect(window.createWebviewPanel).toHaveBeenCalledTimes(3);
  });

  it('disposes all panels on disposeAll', async () => {
    await manager.open('review-1', 'session-1', undefined, 'Review 1');
    await manager.open('review-2', 'session-1', undefined, 'Review 2');
    manager.disposeAll();
    expect(mockDispose).toHaveBeenCalledTimes(2);
  });

  it('sends review:error when SDK call fails', async () => {
    const errorSdk = {
      session: {
        diff: vi.fn().mockRejectedValue(new Error('SDK error')),
      },
    } as unknown as import('./sdk-client').SDKClient;
    const errorManager = new ReviewPanelManager(mockContext, errorSdk);
    await errorManager.open('review-err', 'session-1', undefined, 'Review');
    const calls = mockPostMessage.mock.calls as Array<[Record<string, unknown>]>;
    const reviewErrorCall = calls.find((c) => c[0]?.type === 'review:error');
    expect(reviewErrorCall).toBeDefined();
    const data = reviewErrorCall![0];
    expect(data.type).toBe('review:error');
    expect(data.reviewID).toBe('review-err');
    expect(data.message).toBe('SDK error');
  });
});
