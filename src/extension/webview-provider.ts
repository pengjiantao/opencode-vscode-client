/**
 * @file VS Code WebviewView provider for the OpenCode sidebar.
 * Handles HTML generation, asset path resolution, and CSP configuration.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  CancellationToken,
  Uri,
  Webview,
  WebviewView,
  WebviewViewProvider,
  type ExtensionContext,
} from 'vscode';
import type { IPCBridge } from './ipc';

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

    const distPath = join(this._extensionContext.extensionPath, 'dist', 'webview');
    if (existsSync(distPath)) {
      const indexPath = join(distPath, 'index.html');
      if (existsSync(indexPath)) {
        webviewView.webview.html = this.getWebviewHtml(webviewView.webview, distPath);
      } else {
        webviewView.webview.html = this.getFallbackHtml(webviewView.webview);
      }
    } else {
      webviewView.webview.html = this.getFallbackHtml(webviewView.webview);
    }

    this._ipc.setPanel(webviewView);
  }

  /** Reads the built index.html, resolves asset URIs, and injects CSP + VS Code API script. */
  private getWebviewHtml(webview: Webview, distPath: string): string {
    const indexPath = join(distPath, 'index.html');
    let html = readFileSync(indexPath, 'utf-8');

    // Rewrite asset paths from relative to webview URIs
    const assetsDir = join(distPath, 'assets');
    if (existsSync(assetsDir)) {
      html = html.replace(
        /(href|src)="\.\/assets\/([^"]*)"/g,
        (_match: string, attr: string, file: string) => {
          const fileUri = webview.asWebviewUri(Uri.file(join(assetsDir, file)));
          return `${attr}="${fileUri.toString()}"`;
        },
      );
    }

    // Override CSP to allow connections to local servers
    html = html.replace(
      /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")[^"]*(")/,
      `$1default-src 'self'; script-src 'self' 'unsafe-inline' ${webview.cspSource}; style-src 'self' 'unsafe-inline' ${webview.cspSource}; img-src 'self' data: https:; connect-src 'self' http://127.0.0.1:* https://*; font-src 'self' data:$2`,
    );

    // Vite outputs module scripts; convert to defer for VS Code webview compatibility
    html = html.replace(/ type="module"/g, ' defer');
    html = html.replace(/ crossorigin="[^"]*"/g, '');

    // Inject VS Code API for the webview to use
    html = html.replace(
      '<body>',
      `<body>
  <script>
    const vscode = acquireVsCodeApi();
    window.vscode = vscode;
  </script>`,
    );

    return html;
  }

  /** Returns a minimal fallback HTML page when the built webview is not found. */
  private getFallbackHtml(webview: Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' ${webview.cspSource}; style-src 'self' 'unsafe-inline' ${webview.cspSource}; img-src 'self' data: https:; connect-src 'self' http://127.0.0.1:* https://*;">
  <title>OpenCode Sidebar</title>
  <style>
    body { margin: 0; padding: 0; background-color: var(--vscode-editor-background); color: var(--vscode-editor-foreground); font-family: var(--vscode-font-family); }
    #root { padding: 20px; }
    .error { color: var(--vscode-errorForeground); }
    .info { color: var(--vscode-editor-foreground); }
  </style>
</head>
<body>
  <div id="root">
    <p class="info">OpenCode Sidebar is loading...</p>
    <p class="info">Make sure you have run: npm run build</p>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    window.vscode = vscode;
  </script>
</body>
</html>`;
  }
}
