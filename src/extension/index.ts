import type { Part, Permission } from '@opencode-ai/sdk';
import { commands, window, workspace, type ExtensionContext } from 'vscode';
import { IPCBridge } from './ipc';
import type { SDKClient } from './sdk-client';
import { createSDKClient } from './sdk-client-impl';
import { SessionManager } from './session-manager';
import type { ExtToWebview } from './types';
import { OpencodeSidebarViewProvider } from './webview-provider';

let sdk: SDKClient;
let sessionManager: SessionManager;
let ipc: IPCBridge;
let provider: OpencodeSidebarViewProvider;

export async function activate(context: ExtensionContext): Promise<void> {
  let activeModel: string | undefined;
  let activeAgent: string | undefined;

  try {
    const workspaceRoot = workspace.workspaceFolders?.[0]?.uri.fsPath;
    sdk = createSDKClient(workspaceRoot);
    sessionManager = new SessionManager(sdk);
    ipc = new IPCBridge();
    provider = new OpencodeSidebarViewProvider(context, ipc);

    await sessionManager.connect();

    context.subscriptions.push(
      window.registerWebviewViewProvider('opencode-sidebar.main', provider),
    );

    const handleCreateSession = () => {
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
    };

    const handleSelectHistory = () => {
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

              if (!openIDs.includes(sessionID)) {
                openIDs.push(sessionID);
                void context.workspaceState.update('openSessionIDs', openIDs);
                ipc.send({ type: 'session:created', session: selected.session });
              }

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
    };

    ipc.on('init', () => {
      void sdk.session.list().then((sessions) => {
        const activeSessions = sessions.filter((s) => !(s.time as { archived?: unknown }).archived);
        sessionManager.setSessions(activeSessions);

        let openIDs = context.workspaceState.get<string[]>('openSessionIDs') || [];
        openIDs = openIDs.filter((id) => activeSessions.some((s) => s.id === id));

        let activeID = sessionManager.activeSessionID;
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
      handleCreateSession();
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

          if (previousActiveID === sessionID) {
            if (openIDs.length > 0) {
              const nextActiveID = openIDs[openIDs.length - 1];
              sessionManager.switch(nextActiveID);
              ipc.send({ type: 'session:switched', sessionID: nextActiveID });
              void sessionManager.getMessagesAndParts(nextActiveID).then(({ messages, parts }) => {
                ipc.send({ type: 'messages:list', sessionID: nextActiveID, messages, parts });
              });
            } else {
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

    ipc.on('session:close', (msg) => {
      const { sessionID } = msg as { sessionID: string };
      const previousActiveID = sessionManager.activeSessionID;

      let openIDs = context.workspaceState.get<string[]>('openSessionIDs') || [];
      openIDs = openIDs.filter((id) => id !== sessionID);
      void context.workspaceState.update('openSessionIDs', openIDs);

      ipc.send({ type: 'session:deleted', sessionID });

      if (openIDs.length === 0) {
        handleCreateSession();
        return;
      }

      if (previousActiveID === sessionID) {
        const nextActiveID = openIDs[openIDs.length - 1];
        sessionManager.switch(nextActiveID);
        ipc.send({ type: 'session:switched', sessionID: nextActiveID });
        void sessionManager.getMessagesAndParts(nextActiveID).then(({ messages, parts }) => {
          ipc.send({ type: 'messages:list', sessionID: nextActiveID, messages, parts });
        });
      }
    });

    ipc.on('session:close-all', () => {
      void context.workspaceState.update('openSessionIDs', []);
      ipc.send({ type: 'init', sessions: [] });
      handleCreateSession();
    });

    ipc.on('sessions:select-history', () => {
      handleSelectHistory();
    });

    ipc.on('prompt:send', (msg) => {
      const { text } = msg as { text: string };
      const activeID = sessionManager.activeSessionID;
      if (!activeID) {
        ipc.send({ type: 'error', message: 'No active session' });
        return;
      }
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
      activeModel = model || undefined;
    });

    ipc.on('agent:switch', (msg) => {
      const { agent } = msg as { agent: string };
      activeAgent = agent || undefined;
    });

    sdk.subscribeEvents((event: unknown) => {
      ipc.send({ type: 'event:received', event } as ExtToWebview);

      const evt = event as { type?: string; properties?: { permission?: Permission } };
      if (evt.type === 'permission.updated' && evt.properties?.permission) {
        handlePermissionRequest(evt.properties.permission);
      }
    });

    context.subscriptions.push(
      commands.registerCommand('opencode-sidebar.focus', () => {
        provider.view?.show(true);
      }),
    );

    context.subscriptions.push(
      commands.registerCommand('opencode-sidebar.createSession', () => {
        handleCreateSession();
      }),
    );

    context.subscriptions.push(
      commands.registerCommand('opencode-sidebar.showHistory', () => {
        handleSelectHistory();
      }),
    );

    context.subscriptions.push(
      commands.registerCommand('opencode-sidebar.openSettings', () => {
        ipc.send({ type: 'settings:open' });
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    window.showErrorMessage(`OpenCode Sidebar activation failed: ${message}`);
  }
}

function handlePermissionRequest(permission: Permission): void {
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
