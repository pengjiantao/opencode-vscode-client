/**
 * @file VS Code WebviewView provider for the OpenCode sidebar.
 * Handles HTML generation, asset path resolution, and CSP configuration.
 */

import {
  CancellationToken,
  Uri,
  WebviewView,
  WebviewViewProvider,
  type ExtensionContext,
} from 'vscode';
import type { IPCBridge } from './ipc';
import { getWebviewHtml } from './webview-html';

/** Provides the OpenCode sidebar webview panel. */
export class OpencodeSidebarViewProvider implements WebviewViewProvider {
  private _view?: WebviewView;

  constructor(
    private readonly _extensionContext: ExtensionContext,
    private readonly _ipc: IPCBridge,
  ) {}

  public get view() {
    return this._view;
  }

  /** Resolves the webview, loading either the built index.html or a fallback. */
  resolveWebviewView(
    webviewView: WebviewView,
    context: unknown,
    token: CancellationToken,
  ): void | Thenable<void> {
    void context;
    void token;
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [Uri.joinPath(this._extensionContext.extensionUri, 'dist')],
    };

    webviewView.webview.html = getWebviewHtml(
      webviewView.webview,
      this._extensionContext.extensionPath,
    );

    this._ipc.setPanel(webviewView);
  }
}
