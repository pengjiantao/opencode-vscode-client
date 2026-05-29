/**
 * @file Shared HTML generation utilities for VS Code webview panels.
 * Provides functions to build the HTML shell for webviews with CSP, asset path resolution,
 * and VS Code API injection. Used by both the sidebar provider and review panel manager.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Uri, type Webview } from 'vscode';

/**
 * Reads the built index.html from the webview dist directory, resolves asset URIs,
 * injects CSP headers and the VS Code API script.
 *
 * @param webview The VS Code webview instance for URI resolution.
 * @param extensionPath The extension root path (used to locate dist/webview).
 * @param params Optional query parameters to append to the HTML for routing.
 * @returns The processed HTML string ready for webview assignment.
 */
export function getWebviewHtml(webview: Webview, extensionPath: string, params?: string): string {
  const distPath = join(extensionPath, 'dist', 'webview');
  if (!existsSync(distPath)) {
    return getFallbackHtml(webview, params);
  }
  const indexPath = join(distPath, 'index.html');
  if (!existsSync(indexPath)) {
    return getFallbackHtml(webview, params);
  }

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

  // Override CSP to allow connections to local servers and local webview resources (fonts/images)
  html = html.replace(
    /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")[^"]*(")/,
    `$1default-src 'self'; script-src 'self' 'unsafe-inline' ${webview.cspSource}; style-src 'self' 'unsafe-inline' ${webview.cspSource}; img-src 'self' data: https: ${webview.cspSource}; connect-src 'self' http://127.0.0.1:* https://*; font-src 'self' data: ${webview.cspSource};$2`,
  );

  // Vite outputs module scripts; convert to defer for VS Code webview compatibility
  html = html.replace(/ type="module"/g, ' defer');
  html = html.replace(/ crossorigin="[^"]*"/g, '');

  // Inject VS Code API and optional routing parameters for the webview to use.
  // VS Code webviews don't support URL query parameters, so we inject
  // configuration as a global variable that the React entry point reads.
  const configScript = params
    ? `<script>
    const vscode = acquireVsCodeApi();
    window.vscode = vscode;
    window.__OPENCODE_CONFIG__ = { ${params} };
  </script>`
    : `<script>
    const vscode = acquireVsCodeApi();
    window.vscode = vscode;
  </script>`;

  html = html.replace('<body>', `<body>\n  ${configScript}`);

  return html;
}

/**
 * Returns a minimal fallback HTML page when the built webview is not found.
 *
 * @param webview The VS Code webview instance for CSP source.
 * @param params Optional config parameters to inject.
 * @returns A basic HTML page with loading message and VS Code API injection.
 */
export function getFallbackHtml(webview: Webview, params?: string): string {
  const configScript = params
    ? `<script>
    const vscode = acquireVsCodeApi();
    window.vscode = vscode;
    window.__OPENCODE_CONFIG__ = { ${params} };
  </script>`
    : `<script>
    const vscode = acquireVsCodeApi();
    window.vscode = vscode;
  </script>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' ${webview.cspSource}; style-src 'self' 'unsafe-inline' ${webview.cspSource}; img-src 'self' data: https: ${webview.cspSource}; connect-src 'self' http://127.0.0.1:* https://*; font-src 'self' data: ${webview.cspSource};">
  <title>OpenCode</title>
  <style>
    body { margin: 0; padding: 0; background-color: var(--vscode-editor-background); color: var(--vscode-editor-foreground); font-family: var(--vscode-font-family); }
    #root { padding: 20px; }
    .error { color: var(--vscode-errorForeground); }
    .info { color: var(--vscode-editor-foreground); }
  </style>
</head>
<body>
  <div id="root">
    <p class="info">OpenCode is loading...</p>
    <p class="info">Make sure you have run: npm run build</p>
  </div>
  ${configScript}
</body>
</html>`;
}
