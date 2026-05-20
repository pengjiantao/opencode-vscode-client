/**
 * @file Bidirectional IPC bridge between extension host and webview.
 * Routes typed messages between the two sides via VS Code postMessage API.
 */

import type { WebviewPanel, WebviewView } from 'vscode';
import type { ExtToWebview, WebviewToExt } from './types';

/** Handler type for incoming webview-to-extension messages. */
export type MessageHandler = (message: WebviewToExt) => Promise<void> | void;

/** Manages message passing between extension host and webview panel. */
export class IPCBridge {
  private panel: WebviewPanel | WebviewView | null = null;
  private handlers: Map<string, MessageHandler> = new Map();

  /** Binds to a webview panel and wires up incoming message dispatch. */
  setPanel(panel: WebviewPanel | WebviewView) {
    this.panel = panel;

    this.panel.webview.onDidReceiveMessage((message: WebviewToExt) => {
      const handler = this.handlers.get(message.type);
      if (handler) {
        void handler(message);
      }
    });
  }

  /** Sends a typed message from extension to webview. */
  send(message: ExtToWebview) {
    if (this.panel) {
      this.panel.webview.postMessage(message);
    }
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
