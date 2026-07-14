/**
 * @file Bidirectional IPC bridge between extension host and webview.
 * Routes typed messages between the two sides via VS Code postMessage API.
 * Buffers outgoing messages until the webview signals readiness via {@link markReady},
 * preventing message loss when the webview is reloaded after being hidden.
 */

import type { WebviewPanel, WebviewView } from 'vscode';
import type { ExtToWebview, WebviewToExt } from './types';

/** Handler type for incoming webview-to-extension messages. */
export type MessageHandler = (message: WebviewToExt) => Promise<void> | void;

/** Manages message passing between extension host and webview panel. */
export class IPCBridge {
  private panel: WebviewPanel | WebviewView | null = null;
  private handlers: Map<string, MessageHandler> = new Map();

  /** Tracks the current onDidReceiveMessage subscription for proper disposal. */
  private messageDisposable: { dispose(): void } | null = null;

  /** Tracks the panel/view disposal subscription for proper cleanup. */
  private visibilityDisposable: { dispose(): void } | null = null;

  /** FIFO buffer for messages sent before the webview has signaled readiness. */
  private pendingMessages: ExtToWebview[] = [];

  /**
   * Whether the webview has signaled it is ready to receive messages.
   * Flipped to `true` when {@link markReady} is called (triggered by the
   * webview's `init` message), and reset to `false` on each {@link setPanel}
   * or when the webview is disposed.
   */
  private ready = false;

  /** Binds to a webview panel and wires up incoming message dispatch. */
  setPanel(panel: WebviewPanel | WebviewView) {
    // Dispose previous subscriptions to prevent stacking
    this.messageDisposable?.dispose();
    this.visibilityDisposable?.dispose();

    this.panel = panel;
    this.ready = false;
    // NOTE: pendingMessages is intentionally NOT cleared here. Messages
    // buffered before the webview was ready (e.g. right-click "Send to
    // OpenCode") must survive the webview reload triggered by show().
    // They will be flushed when markReady() is called after the webview
    // sends its 'init' message.

    this.messageDisposable = panel.webview.onDidReceiveMessage((message: WebviewToExt) => {
      const handler = this.handlers.get(message.type);
      if (handler) {
        void handler(message);
      }
    });

    // Reset ready flag when the webview becomes hidden (sidebar switched away).
    // The webview DOM is destroyed when hidden, so subsequent send() calls
    // must buffer messages instead of trying to postMessage to a dead panel.
    // When the sidebar is shown again, resolveWebviewView fires, setPanel()
    // is called, and the webview will send 'init' to trigger markReady().
    if ('onDidChangeVisibility' in panel) {
      this.visibilityDisposable = panel.onDidChangeVisibility(() => {
        if (!panel.visible) {
          this.ready = false;
        }
      });
    }
  }

  /**
   * Sends a typed message from extension to webview.
   *
   * Messages are always buffered when the webview is not ready. They will be
   * delivered once {@link markReady} is called after the webview sends its
   * `init` message. This prevents message loss when:
   * - The webview has never been activated (panel is null)
   * - The webview is reloading after being hidden (ready is false)
   */
  send(message: ExtToWebview) {
    if (this.panel && this.ready) {
      this.panel.webview.postMessage(message);
    } else {
      this.pendingMessages.push(message);
    }
  }

  /**
   * Marks the webview as ready and flushes all buffered messages.
   *
   * Called from the `init` IPC handler — the first message the webview sends
   * after React mounts and all `window.addEventListener('message')` handlers
   * are registered. Replays buffered messages in FIFO order so that selection
   * chips arrive before heavier session/model data.
   */
  markReady() {
    this.ready = true;
    for (const msg of this.pendingMessages) {
      this.panel?.webview.postMessage(msg);
    }
    this.pendingMessages = [];
  }

  /** Registers a handler for a specific message type. */
  on(type: string, handler: MessageHandler) {
    this.handlers.set(type, handler);
  }

  /** Removes the handler for a specific message type. */
  off(type: string) {
    this.handlers.delete(type);
  }
}
