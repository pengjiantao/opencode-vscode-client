import type { Part, Permission } from '@opencode-ai/sdk';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  CancellationToken,
  commands,
  Uri,
  WebviewViewProvider,
  window,
  workspace,
  type ExtensionContext,
  type Webview,
} from 'vscode';
import { IPCBridge } from './ipc';
import type { SDKClient } from './sdk-client';
import { createSDKClient } from './sdk-client-impl';
import { SessionManager } from './session-manager';
import type { ExtToWebview } from './types';

let sdk: SDKClient;
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

  let activeModel: string | undefined;
  let activeAgent: string | undefined;

  try {
    const workspaceRoot = workspace.workspaceFolders?.[0]?.uri.fsPath;
    const sdkClient = createSDKClient(workspaceRoot);
    sdk = sdkClient;
    sessionManager = new SessionManager(sdk);
    ipc = new IPCBridge();

    await sessionManager.connect();

    context.subscriptions.push(
      window.registerWebviewViewProvider('opencode-sidebar.main', provider),
    );

    ipc.on('init', () => {
      void sdk.session.list().then((sessions) => {
        const activeSessions = sessions.filter((s) => !(s.time as { archived?: unknown }).archived);
        sessionManager.setSessions(activeSessions);

        let openIDs = context.workspaceState.get<string[]>('openSessionIDs') || [];
        // Filter out IDs that do not exist or are archived
        openIDs = openIDs.filter((id) => activeSessions.some((s) => s.id === id));

        let activeID = sessionManager.activeSessionID;
        // Resolve active session
        if (!activeID || !openIDs.includes(activeID)) {
          if (openIDs.length > 0) {
            activeID = openIDs[0];
          } else if (activeSessions.length > 0) {
            const sorted = [...activeSessions].sort(
              (a, b) => (b.time?.updated || 0) - (a.time?.updated || 0),
            );
            const mostRecent = sorted[0];
            openIDs = [mostRecent.id];
            activeID = mostRecent.id;
          }
        }

        // If no sessions exist in DB, create a new one automatically
        if (!activeID) {
          void sessionManager
            .create()
            .then((session) => {
              openIDs = [session.id];
              void context.workspaceState.update('openSessionIDs', openIDs);
              ipc.send({ type: 'init', sessions: [session] });
              ipc.send({ type: 'session:switched', sessionID: session.id });
              ipc.send({ type: 'messages:list', sessionID: session.id, messages: [], parts: [] });
            })
            .catch((err) => {
              console.error('Failed to auto-create session on init:', err);
            });
        } else {
          sessionManager.switch(activeID);
          void context.workspaceState.update('openSessionIDs', openIDs);

          const openSessions = activeSessions.filter((s) => openIDs.includes(s.id));
          ipc.send({ type: 'init', sessions: openSessions });
          ipc.send({ type: 'session:switched', sessionID: activeID });

          void sessionManager
            .getMessagesAndParts(activeID)
            .then(({ messages, parts }) => {
              ipc.send({ type: 'messages:list', sessionID: activeID, messages, parts });
            })
            .catch((err) => {
              console.error('Failed to load messages on init:', err);
            });
        }
      });

      void sdk
        .getModels()
        .then((models) => {
          ipc.send({ type: 'models:list', models });
        })
        .catch((err) => {
          console.error('Failed to load models:', err);
        });

      void sdk
        .getAgents()
        .then((agents) => {
          ipc.send({ type: 'agents:list', agents });
        })
        .catch((err) => {
          console.error('Failed to load agents:', err);
        });
    });

    ipc.on('session:create', () => {
      sessionManager
        .create()
        .then((session) => {
          const openIDs = context.workspaceState.get<string[]>('openSessionIDs') || [];
          if (!openIDs.includes(session.id)) {
            openIDs.push(session.id);
            void context.workspaceState.update('openSessionIDs', openIDs);
          }
          ipc.send({ type: 'session:created', session });
          ipc.send({ type: 'session:switched', sessionID: session.id });
          ipc.send({ type: 'messages:list', sessionID: session.id, messages: [], parts: [] });
        })
        .catch((err) => {
          ipc.send({ type: 'error', message: (err as Error).message });
        });
    });

    ipc.on('session:switch', (msg) => {
      const { sessionID } = msg as { sessionID: string };
      sessionManager.switch(sessionID);
      ipc.send({ type: 'session:switched', sessionID });
      void sessionManager
        .getMessagesAndParts(sessionID)
        .then(({ messages, parts }) => {
          ipc.send({ type: 'messages:list', sessionID, messages, parts });
        })
        .catch((err) => {
          ipc.send({ type: 'error', message: (err as Error).message });
        });
    });

    ipc.on('session:archive', (msg) => {
      const { sessionID } = msg as { sessionID: string };
      const previousActiveID = sessionManager.activeSessionID;
      sessionManager
        .archive(sessionID)
        .then(() => {
          let openIDs = context.workspaceState.get<string[]>('openSessionIDs') || [];
          openIDs = openIDs.filter((id) => id !== sessionID);
          void context.workspaceState.update('openSessionIDs', openIDs);

          ipc.send({ type: 'session:archived', sessionID });

          // If the archived session was the active one, switch to the next open one, or create new
          if (previousActiveID === sessionID) {
            if (openIDs.length > 0) {
              const nextActiveID = openIDs[openIDs.length - 1];
              sessionManager.switch(nextActiveID);
              ipc.send({ type: 'session:switched', sessionID: nextActiveID });
              void sessionManager.getMessagesAndParts(nextActiveID).then(({ messages, parts }) => {
                ipc.send({ type: 'messages:list', sessionID: nextActiveID, messages, parts });
              });
            } else {
              // Create a brand new session
              void sessionManager.create().then((session) => {
                const nextOpen = [session.id];
                void context.workspaceState.update('openSessionIDs', nextOpen);
                ipc.send({ type: 'session:created', session });
                ipc.send({ type: 'session:switched', sessionID: session.id });
                ipc.send({ type: 'messages:list', sessionID: session.id, messages: [], parts: [] });
              });
            }
          }
        })
        .catch((err) => {
          ipc.send({ type: 'error', message: (err as Error).message });
        });
    });

    ipc.on('sessions:select-history', () => {
      void sdk.session
        .list()
        .then((sessions) => {
          const activeSessions = sessions.filter(
            (s) => !(s.time as { archived?: unknown }).archived,
          );
          if (activeSessions.length === 0) {
            void window.showInformationMessage('No previous sessions found.');
            return;
          }

          // Sort by last updated time desc
          const sorted = [...activeSessions].sort(
            (a, b) => (b.time?.updated || 0) - (a.time?.updated || 0),
          );

          const items = sorted.map((s) => ({
            label: s.title || 'Untitled Session',
            description: new Date(s.time.updated || s.time.created).toLocaleString(),
            sessionID: s.id,
            session: s,
          }));

          void window
            .showQuickPick(items, {
              placeHolder: 'Select a previous session to open',
              title: 'OpenCode Session History',
            })
            .then((selected) => {
              if (!selected) return;

              const sessionID = selected.sessionID;
              const openIDs = context.workspaceState.get<string[]>('openSessionIDs') || [];

              // If not already in open tabs list, add it and notify webview
              if (!openIDs.includes(sessionID)) {
                openIDs.push(sessionID);
                void context.workspaceState.update('openSessionIDs', openIDs);
                ipc.send({ type: 'session:created', session: selected.session });
              }

              // Switch to it
              sessionManager.switch(sessionID);
              ipc.send({ type: 'session:switched', sessionID });
              void sessionManager.getMessagesAndParts(sessionID).then(({ messages, parts }) => {
                ipc.send({ type: 'messages:list', sessionID, messages, parts });
              });
            });
        })
        .catch((err) => {
          void window.showErrorMessage(
            `Failed to retrieve session history: ${(err as Error).message}`,
          );
        });
    });

    ipc.on('prompt:send', (msg) => {
      const { text } = msg as { text: string };
      const activeID = sessionManager.activeSessionID;
      console.log(
        '[Extension] Received prompt:send event with text:',
        text,
        'activeSessionID:',
        activeID,
      );
      if (!activeID) {
        console.warn('[Extension] No active session found. Aborting prompt:send.');
        ipc.send({ type: 'error', message: 'No active session' });
        return;
      }
      console.log('[Extension] Calling sessionManager.sendPrompt');
      sessionManager
        .sendPrompt(
          activeID,
          [
            {
              type: 'text',
              id: 'temp',
              sessionID: activeID,
              messageID: 'temp',
              text,
            } as unknown as Part,
          ],
          activeModel,
          activeAgent,
        )
        .then(() => {
          console.log('[Extension] sendPrompt finished initiating successfully.');
        })
        .catch((err) => {
          console.error('[Extension] sendPrompt failed with error:', err);
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
      activeModel = model || undefined;
    });

    ipc.on('agent:switch', (msg) => {
      const { agent } = msg as { agent: string };
      activeAgent = agent || undefined;
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
