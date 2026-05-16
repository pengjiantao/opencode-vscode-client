import type { WebviewPanel, WebviewView } from 'vscode';
import type { ExtToWebview, WebviewToExt } from './types';

export type MessageHandler = (message: WebviewToExt) => void;

export class IPCBridge {
  private panel: WebviewPanel | WebviewView | null = null;
  private handlers: Map<string, MessageHandler> = new Map();

  setPanel(panel: WebviewPanel | WebviewView) {
    this.panel = panel;

    this.panel.webview.onDidReceiveMessage((message: WebviewToExt) => {
      const handler = this.handlers.get(message.type);
      if (handler) {
        handler(message);
      }
    });
  }

  send(message: ExtToWebview) {
    if (this.panel) {
      this.panel.webview.postMessage(message);
    }
  }

  on(type: string, handler: MessageHandler) {
    this.handlers.set(type, handler);
  }

  off(type: string) {
    this.handlers.delete(type);
  }
}
