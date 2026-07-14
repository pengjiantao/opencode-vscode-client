/**
 * @file Unit tests for IPCBridge message buffering and readiness behavior.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WebviewView } from 'vscode';
import { IPCBridge } from './ipc';
import type { ExtToWebview, WebviewToExt } from './types';

/** Creates a mock webview panel/view with capturable postMessage and onDidReceiveMessage. */
function createMockPanel() {
  const postedMessages: ExtToWebview[] = [];
  let messageHandler: ((msg: WebviewToExt) => void) | undefined;
  let visibilityHandler: (() => void) | undefined;
  const messageDisposable = { dispose: vi.fn() };
  const visibilityDisposable = { dispose: vi.fn() };
  let visible = true;

  const panel = {
    webview: {
      postMessage: vi.fn((msg: ExtToWebview) => {
        postedMessages.push(msg);
      }),
      onDidReceiveMessage: vi.fn((handler: (msg: WebviewToExt) => void) => {
        messageHandler = handler;
        return messageDisposable;
      }),
    },
    onDidChangeVisibility: vi.fn((handler: () => void) => {
      visibilityHandler = handler;
      return visibilityDisposable;
    }),
    get visible() {
      return visible;
    },
  } as unknown as WebviewView;

  return {
    panel,
    postedMessages,
    messageHandler: () => messageHandler,
    /** Simulate the sidebar becoming hidden. */
    triggerHidden: () => {
      visible = false;
      visibilityHandler?.();
    },
    /** Simulate the sidebar becoming visible again. */
    triggerVisible: () => {
      visible = true;
      visibilityHandler?.();
    },
    messageDisposable,
    visibilityDisposable,
  };
}

describe('IPCBridge', () => {
  let bridge: IPCBridge;

  beforeEach(() => {
    bridge = new IPCBridge();
  });

  describe('message buffering before markReady', () => {
    it('buffers messages sent before markReady()', () => {
      const { panel, postedMessages } = createMockPanel();
      bridge.setPanel(panel);

      const msg1: ExtToWebview = {
        type: 'editor:selection',
        text: 'const x = 1;',
        filename: 'test.ts',
        path: '/test.ts',
        startLine: 1,
        endLine: 1,
        action: 'insert',
      };
      const msg2: ExtToWebview = {
        type: 'editor:selection',
        text: 'const y = 2;',
        filename: 'test2.ts',
        path: '/test2.ts',
        startLine: 5,
        endLine: 10,
        action: 'insert',
      };

      bridge.send(msg1);
      bridge.send(msg2);

      expect(postedMessages).toHaveLength(0);
    });

    it('replays buffered messages in FIFO order on markReady()', () => {
      const { panel, postedMessages } = createMockPanel();
      bridge.setPanel(panel);

      const msg1: ExtToWebview = {
        type: 'editor:selection',
        text: 'first',
        filename: 'a.ts',
        path: '/a.ts',
        startLine: 1,
        endLine: 1,
        action: 'insert',
      };
      const msg2: ExtToWebview = {
        type: 'editor:selection',
        text: 'second',
        filename: 'b.ts',
        path: '/b.ts',
        startLine: 2,
        endLine: 2,
        action: 'explain',
      };

      bridge.send(msg1);
      bridge.send(msg2);
      bridge.markReady();

      expect(postedMessages).toHaveLength(2);
      expect(postedMessages[0]).toBe(msg1);
      expect(postedMessages[1]).toBe(msg2);
    });

    it('clears the buffer after replay', () => {
      const { panel, postedMessages } = createMockPanel();
      bridge.setPanel(panel);

      bridge.send({
        type: 'terminal:selection',
        text: 'output',
        linesCount: 3,
        action: 'insert',
      });
      bridge.markReady();

      // Second markReady should be a no-op
      bridge.markReady();
      expect(postedMessages).toHaveLength(1);
    });
  });

  describe('message delivery after markReady', () => {
    it('delivers messages immediately after markReady()', () => {
      const { panel, postedMessages } = createMockPanel();
      bridge.setPanel(panel);
      bridge.markReady();

      const msg: ExtToWebview = {
        type: 'editor:selection',
        text: 'live',
        filename: 'c.ts',
        path: '/c.ts',
        startLine: 1,
        endLine: 1,
        action: 'insert',
      };
      bridge.send(msg);

      expect(postedMessages).toHaveLength(1);
      expect(postedMessages[0]).toBe(msg);
    });
  });

  describe('setPanel lifecycle', () => {
    it('resets ready state on setPanel()', () => {
      const first = createMockPanel();
      bridge.setPanel(first.panel);
      bridge.markReady();

      const second = createMockPanel();
      bridge.setPanel(second.panel);

      // send after new panel should be buffered (ready was reset)
      bridge.send({
        type: 'editor:selection',
        text: 'after reset',
        filename: 'd.ts',
        path: '/d.ts',
        startLine: 1,
        endLine: 1,
        action: 'insert',
      });
      expect(second.postedMessages).toHaveLength(0);

      // After markReady, the new message should be delivered
      bridge.markReady();
      expect(second.postedMessages).toHaveLength(1);
    });

    it('disposes previous subscriptions on setPanel()', () => {
      const first = createMockPanel();
      bridge.setPanel(first.panel);

      const second = createMockPanel();
      bridge.setPanel(second.panel);

      expect(first.messageDisposable.dispose).toHaveBeenCalledTimes(1);
      expect(first.visibilityDisposable.dispose).toHaveBeenCalledTimes(1);
    });

    it('preserves pending messages across setPanel() for webview reload', () => {
      const first = createMockPanel();
      bridge.setPanel(first.panel);

      const msg: ExtToWebview = {
        type: 'editor:selection',
        text: 'preserved',
        filename: 'e.ts',
        path: '/e.ts',
        startLine: 1,
        endLine: 1,
        action: 'insert',
      };
      bridge.send(msg);

      // Simulate webview reload: setPanel is called again (resolveWebviewView)
      const second = createMockPanel();
      bridge.setPanel(second.panel);
      bridge.markReady();

      // The message buffered before setPanel should be delivered to the new panel
      expect(first.postedMessages).toHaveLength(0);
      expect(second.postedMessages).toHaveLength(1);
      expect(second.postedMessages[0]).toBe(msg);
    });
  });

  describe('visibility changes', () => {
    it('resets ready flag when sidebar becomes hidden', () => {
      const { panel, postedMessages, triggerHidden } = createMockPanel();
      bridge.setPanel(panel);
      bridge.markReady();

      // After markReady, messages are delivered immediately
      bridge.send({
        type: 'editor:selection',
        text: 'before hide',
        filename: 'g.ts',
        path: '/g.ts',
        startLine: 1,
        endLine: 1,
        action: 'insert',
      });
      expect(postedMessages).toHaveLength(1);

      // Simulate sidebar hidden
      triggerHidden();

      // After hiding, messages should be buffered again
      bridge.send({
        type: 'editor:selection',
        text: 'after hide',
        filename: 'h.ts',
        path: '/h.ts',
        startLine: 2,
        endLine: 2,
        action: 'insert',
      });
      expect(postedMessages).toHaveLength(1); // still 1, second message buffered
    });

    it('replays messages buffered after hide when markReady is called again', () => {
      const { panel, triggerHidden } = createMockPanel();
      bridge.setPanel(panel);
      bridge.markReady();

      // Simulate sidebar hidden
      triggerHidden();

      // Buffer a message (user right-clicks while sidebar is hidden)
      const msg: ExtToWebview = {
        type: 'editor:selection',
        text: 'after hide',
        filename: 'i.ts',
        path: '/i.ts',
        startLine: 1,
        endLine: 1,
        action: 'insert',
      };
      bridge.send(msg);

      // Simulate sidebar shown again (new webview instance)
      const newPanel = createMockPanel();
      bridge.setPanel(newPanel.panel);
      bridge.markReady();

      // The message should be delivered to the new panel
      expect(newPanel.postedMessages).toHaveLength(1);
      expect(newPanel.postedMessages[0]).toBe(msg);
    });

    it('does not reset ready flag when sidebar becomes visible', () => {
      const { panel, postedMessages, triggerHidden, triggerVisible } = createMockPanel();
      bridge.setPanel(panel);
      bridge.markReady();

      // Hide then show
      triggerHidden();
      triggerVisible();

      // send should buffer (ready was reset on hide, not restored on show)
      bridge.send({
        type: 'editor:selection',
        text: 'after show',
        filename: 'j.ts',
        path: '/j.ts',
        startLine: 1,
        endLine: 1,
        action: 'insert',
      });
      expect(postedMessages).toHaveLength(0); // buffered, not sent
    });
  });

  describe('send() without panel', () => {
    it('buffers messages when no panel is set yet', () => {
      const msg: ExtToWebview = {
        type: 'editor:selection',
        text: 'no panel',
        filename: 'f.ts',
        path: '/f.ts',
        startLine: 1,
        endLine: 1,
        action: 'insert',
      };
      bridge.send(msg);

      // Message should be buffered, not dropped
      // Simulate webview later becoming active
      const { panel, postedMessages } = createMockPanel();
      bridge.setPanel(panel);
      bridge.markReady();

      expect(postedMessages).toHaveLength(1);
      expect(postedMessages[0]).toBe(msg);
    });
  });

  describe('incoming message dispatch', () => {
    it('dispatches incoming messages to registered handlers', () => {
      const { panel, messageHandler } = createMockPanel();
      bridge.setPanel(panel);

      const handler = vi.fn();
      bridge.on('init', handler);

      const incoming: WebviewToExt = { type: 'init' };
      messageHandler()!(incoming);

      expect(handler).toHaveBeenCalledWith(incoming);
    });

    it('ignores messages with unregistered types', () => {
      const { panel, messageHandler } = createMockPanel();
      bridge.setPanel(panel);

      // Should not throw
      const incoming = { type: 'unknown:type' } as unknown as WebviewToExt;
      messageHandler()!(incoming);
    });

    it('removes handler on off()', () => {
      const { panel, messageHandler } = createMockPanel();
      bridge.setPanel(panel);

      const handler = vi.fn();
      bridge.on('init', handler);
      bridge.off('init');

      messageHandler()!({ type: 'init' });
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
