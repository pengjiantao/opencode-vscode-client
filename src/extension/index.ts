import type { Message, Part, Permission, Session } from '@opencode-ai/sdk';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  CancellationToken,
  commands,
  Uri,
  WebviewViewProvider,
  window,
  type ExtensionContext,
  type Webview,
} from 'vscode';
import { IPCBridge } from './ipc';
import { createSDKClient } from './sdk-client-impl';
import { SessionManager } from './session-manager';
import type { ExtToWebview } from './types';

interface SDKClientInterface {
  session: {
    create(): Promise<Session>;
    list(): Promise<Session[]>;
    get(id: string): Promise<Session>;
    update(id: string, patch: Partial<Session>): Promise<Session>;
    delete(id: string): Promise<void>;
    messages(id: string): Promise<Message[]>;
    prompt(id: string, parts: Part[]): Promise<void>;
    promptAsync(id: string, parts: Part[]): Promise<void>;
    abort(id: string): Promise<void>;
  };
  subscribeEvents(handler: (event: unknown) => void): () => void;
  startServer(): Promise<{ url: string; close(): void }>;
}

let sdk: SDKClientInterface;
let sessionManager: SessionManager;
let ipc: IPCBridge;
let currentView: { webview: Webview; show(preserveFocus?: boolean): void } | undefined;
let extensionContext: ExtensionContext;

class OpencodeSidebarViewProvider implements WebviewViewProvider {
  resolveWebviewView(
    webviewView: { webview: Webview; show(preserveFocus?: boolean): void },
    context: unknown,
    token: CancellationToken,
  ): void | Thenable<void> {
    void context;
    void token;
    currentView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [Uri.joinPath(extensionContext.extensionUri, 'dist')],
    };

    const distPath = join(extensionContext.extensionPath, 'dist', 'webview');
    if (existsSync(distPath)) {
      const indexPath = join(distPath, 'index.html');
      if (existsSync(indexPath)) {
        webviewView.webview.html = getWebviewHtml(webviewView.webview, distPath);
      } else {
        webviewView.webview.html = getFallbackHtml(webviewView.webview);
      }
    } else {
      webviewView.webview.html = getFallbackHtml(webviewView.webview);
    }

    ipc.setPanel(webviewView as never);
  }
}

const provider = new OpencodeSidebarViewProvider();

export async function activate(context: ExtensionContext): Promise<void> {
  extensionContext = context;

  try {
    const sdkClient = createSDKClient();
    sdk = sdkClient;
    sessionManager = new SessionManager(sdk);
    ipc = new IPCBridge();

    await sessionManager.connect();

    context.subscriptions.push(
      window.registerWebviewViewProvider('opencode-sidebar.main', provider),
    );

    ipc.on('init', () => {
      void sdk.session.list().then((sessions) => {
        const activeID = sessionManager.activeSessionID;
        ipc.send({ type: 'init', sessions });
        if (activeID) {
          ipc.send({ type: 'session:switched', sessionID: activeID });
        }
      });
    });

    ipc.on('session:create', () => {
      sessionManager
        .create()
        .then((session) => {
          ipc.send({ type: 'session:created', session });
          ipc.send({ type: 'session:switched', sessionID: session.id });
        })
        .catch((err) => {
          ipc.send({ type: 'error', message: (err as Error).message });
        });
    });

    ipc.on('session:switch', (msg) => {
      const { sessionID } = msg as { sessionID: string };
      sessionManager.switch(sessionID);
      ipc.send({ type: 'session:switched', sessionID });
    });

    ipc.on('session:archive', (msg) => {
      const { sessionID } = msg as { sessionID: string };
      sessionManager
        .archive(sessionID)
        .then(() => {
          ipc.send({ type: 'session:archived', sessionID });
        })
        .catch((err) => {
          ipc.send({ type: 'error', message: (err as Error).message });
        });
    });

    ipc.on('prompt:send', (msg) => {
      const { text } = msg as { text: string };
      const activeID = sessionManager.activeSessionID;
      if (!activeID) {
        ipc.send({ type: 'error', message: 'No active session' });
        return;
      }
      sessionManager
        .sendPrompt(activeID, [
          {
            type: 'text',
            id: 'temp',
            sessionID: activeID,
            messageID: 'temp',
            text,
          } as unknown as Part,
        ])
        .catch((err) => {
          ipc.send({ type: 'error', message: (err as Error).message });
        });
    });

    ipc.on('prompt:abort', (msg) => {
      const { sessionID } = msg as { sessionID: string };
      sessionManager.abort(sessionID).catch((err) => {
        ipc.send({ type: 'error', message: (err as Error).message });
      });
    });

    ipc.on('model:switch', (msg) => {
      const { model } = msg as { model: string };
      void model;
    });

    ipc.on('agent:switch', (msg) => {
      const { agent } = msg as { agent: string };
      void agent;
    });

    ipc.on('permission:reply', (msg) => {
      const { permissionID, allow } = msg as { permissionID: string; allow: boolean };
      void permissionID;
      void allow;
    });

    sdk.subscribeEvents((event: unknown) => {
      ipc.send({ type: 'event:received', event } as ExtToWebview);

      const evt = event as { type?: string; properties?: { permission?: Permission } };
      if (evt.type === 'permission.updated' && evt.properties?.permission) {
        handlePermissionRequest(evt.properties.permission);
      }
    });

    sessionManager.subscribe(() => {
      // Handle session state changes
    });

    context.subscriptions.push(
      commands.registerCommand('opencode-sidebar.focus', () => {
        currentView?.show(true);
      }),
    );

    context.subscriptions.push({
      dispose: () => {
        // cleanup
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    window.showErrorMessage(`OpenCode Sidebar activation failed: ${message}`);
    console.error('OpenCode Sidebar activation error:', err);
  }
}

function handlePermissionRequest(permission: Permission): void {
  void permission;
  window
    .showInformationMessage(
      `OpenCode Permission: ${permission.title}`,
      { modal: false },
      'Allow',
      'Deny',
    )
    .then(() => {
      // Permission handling via IPC
    });
}

function getWebviewHtml(webview: Webview, distPath: string): string {
  const indexPath = join(distPath, 'index.html');
  let html = readFileSync(indexPath, 'utf-8');

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

  html = html.replace(
    /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")[^"]*(")/,
    `$1default-src 'self'; script-src 'self' 'unsafe-inline' ${webview.cspSource}; style-src 'self' 'unsafe-inline' ${webview.cspSource}; img-src 'self' data: https:; connect-src 'self' http://127.0.0.1:* https://*; font-src 'self' data:$2`,
  );

  html = html.replace(/ type="module"/g, ' defer');
  html = html.replace(/ crossorigin="[^"]*"/g, '');

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

function getFallbackHtml(webview: Webview): string {
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
