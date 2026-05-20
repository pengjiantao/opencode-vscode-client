/**
 * @file VS Code extension activation entry point.
 * Initializes SDK client, session manager, IPC bridge, and webview provider.
 * Registers all IPC message handlers for session lifecycle and prompt operations.
 */

import type { Part, PermissionRequest, SessionStatus } from '@opencode-ai/sdk/v2/client';
import { StatusBarAlignment, ThemeColor, window, workspace, type ExtensionContext } from 'vscode';
import { registerExtensionCommands } from './commands';
import { IPCBridge } from './ipc';
import { syncMetadata as importSyncMetadata } from './metadata';
import type { SDKClient } from './sdk-client';
import { createSDKClient } from './sdk-client-impl';
import { SessionManager } from './session-manager';
import type { ExtToWebview } from './types';
import { handleCommandPart } from './utils/command-router';
import { registerFileHandlers } from './utils/fileHandlers';
import { OpencodeSidebarViewProvider } from './webview-provider';

let sdk: SDKClient;
let sessionManager: SessionManager;
let ipc: IPCBridge;
let provider: OpencodeSidebarViewProvider;

/**
 * Activates the OpenCode sidebar extension.
 * Sets up SDK connection, IPC handlers for session/prompt/model operations.
 */
export async function activate(context: ExtensionContext): Promise<void> {
  let activeModel = context.globalState.get<string>('lastUsedModel');
  let activeAgent = context.globalState.get<string>('lastUsedAgent');
  const sessionStatuses = new Map<string, SessionStatus>();

  try {
    const workspaceRoot = workspace.workspaceFolders?.[0]?.uri.fsPath;
    sdk = createSDKClient(workspaceRoot);
    sessionManager = new SessionManager(sdk);
    ipc = new IPCBridge();
    provider = new OpencodeSidebarViewProvider(context, ipc);

    /**
     * Gathers all LSP servers, MCP servers, workspace plugins, discovered skills,
     * workspace root name, and extension version, and pushes them to the webview.
     */
    const syncMetadata = (): void => {
      void importSyncMetadata(sdk, ipc.send.bind(ipc));
    };

    // Initialize native status bar item to show current session processing status
    const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 100);
    statusBarItem.name = 'OpenCode Status';
    statusBarItem.command = 'opencode-sidebar.focus';
    statusBarItem.text = '$(circle-outline) OpenCode: Ready';
    statusBarItem.tooltip = 'OpenCode is idle and ready';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    /**
     * Updates the native status bar item's styling and text to match
     * the active session's latest processing state.
     */
    const updateStatusBar = (): void => {
      const activeSessionID = sessionManager.activeSessionID;
      if (!activeSessionID) {
        statusBarItem.hide();
        return;
      }

      const status = sessionStatuses.get(activeSessionID);
      if (!status || status.type === 'idle') {
        statusBarItem.text = '$(circle-outline) OpenCode: Ready';
        statusBarItem.tooltip = `Session: ${activeSessionID}\nStatus: Ready`;
        statusBarItem.backgroundColor = undefined;
      } else if (status.type === 'busy') {
        statusBarItem.text = '$(sync~spin) OpenCode: Processing...';
        statusBarItem.tooltip = `Session: ${activeSessionID}\nStatus: Processing`;
        statusBarItem.backgroundColor = undefined;
      } else if (status.type === 'retry') {
        statusBarItem.text = `$(warning) OpenCode: Retrying (${status.attempt}/${status.next})`;
        statusBarItem.tooltip = `Session: ${activeSessionID}\nStatus: Retrying...\nMessage: ${status.message || 'None'}`;
        statusBarItem.backgroundColor = new ThemeColor('statusBarItem.warningBackground');
      }
      statusBarItem.show();
    };

    // Keep status bar in sync when active session changes, registering a disposable for clean cleanup
    const unsubscribeActiveSession = sessionManager.subscribe(() => {
      updateStatusBar();
    });
    context.subscriptions.push({ dispose: unsubscribeActiveSession });

    await sessionManager.connect();

    context.subscriptions.push(
      window.registerWebviewViewProvider('opencode-sidebar.main', provider),
    );

    /** Creates a new session, persists to workspace state, and notifies webview. */
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

    /** Shows a QuickPick list to select and reopen a previous session from history. */
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

    /** Handles webview initialization: loads sessions, messages, models, and agents. */
    ipc.on('init', () => {
      void sdk.session.list().then((sessions) => {
        const activeSessions = sessions.filter((s) => !(s.time as { archived?: unknown }).archived);
        sessionManager.setSessions(activeSessions);

        let openIDs = context.workspaceState.get<string[]>('openSessionIDs') || [];
        // Remove stale session IDs that no longer exist on the server
        openIDs = openIDs.filter((id) => activeSessions.some((s) => s.id === id));

        let activeID = sessionManager.activeSessionID;
        // Fall back to first open session or most recent active session
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

        // No active session found — auto-create one
        if (!activeID) {
          void sessionManager
            .create()
            .then((session) => {
              openIDs = [session.id];
              void context.workspaceState.update('openSessionIDs', openIDs);
              ipc.send({ type: 'init', sessions: [session], activeModel, activeAgent });
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
          ipc.send({ type: 'init', sessions: openSessions, activeModel, activeAgent });
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
        })
        .finally(() => {
          void syncMetadata();
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
          void syncMetadata();
        })
        .catch((err) => {
          ipc.send({ type: 'error', message: (err as Error).message });
        });
    });

    ipc.on('session:archive', (msg) => {
      const { sessionID } = msg as { sessionID: string };
      // Delete session status to prevent unbounded map growth
      sessionStatuses.delete(sessionID);
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
      // Delete session status to prevent unbounded map growth
      sessionStatuses.delete(sessionID);
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
      // Clear all statuses to prevent memory leaks and unbounded map growth
      sessionStatuses.clear();
      void context.workspaceState.update('openSessionIDs', []);
      ipc.send({ type: 'init', sessions: [] });
      handleCreateSession();
    });

    ipc.on('sessions:select-history', () => {
      handleSelectHistory();
    });

    ipc.on('prompt:send', (msg) => {
      const { text, parts } = msg as { text?: string; parts?: Part[] };
      const activeID = sessionManager.activeSessionID;
      if (!activeID) {
        ipc.send({ type: 'error', message: 'No active session' });
        return;
      }

      // Detect command parts and route to the dedicated command execution endpoint
      const handled = handleCommandPart({
        parts,
        text,
        activeID,
        activeModel,
        activeAgent,
        sessionManager,
        ipc,
      });
      if (handled) {
        return;
      }

      const promptParts = parts || [
        {
          type: 'text',
          id: 'temp',
          sessionID: activeID,
          messageID: 'temp',
          text: text || '',
        } as unknown as Part,
      ];

      sessionManager.sendPrompt(activeID, promptParts, activeModel, activeAgent).catch((err) => {
        ipc.send({ type: 'error', message: (err as Error).message });
      });
    });

    registerFileHandlers(ipc);

    ipc.on('prompt:abort', (msg) => {
      const { sessionID } = msg as { sessionID: string };
      sessionManager.abort(sessionID).catch((err) => {
        ipc.send({ type: 'error', message: (err as Error).message });
      });
    });

    ipc.on('model:switch', (msg) => {
      const { model } = msg as { model: string };
      activeModel = model || undefined;
      void context.globalState.update('lastUsedModel', model || undefined);
      void syncMetadata();
    });

    ipc.on('agent:switch', (msg) => {
      const { agent } = msg as { agent: string };
      activeAgent = agent || undefined;
      void context.globalState.update('lastUsedAgent', agent || undefined);
      void syncMetadata();
    });

    ipc.on('permission:reply', (msg) => {
      const { permissionID, allow } = msg as { permissionID: string; allow: boolean };
      void sdk.permission.reply(permissionID, allow);
    });

    // Subscribe to events and register disposable to prevent memory leaks
    const unsubscribeEvents = sdk.subscribeEvents((event: unknown) => {
      // Forward SSE events to webview and handle permission prompts
      ipc.send({ type: 'event:received', event } as ExtToWebview);

      const evt = event as {
        type?: string;
        properties?: {
          permission?: PermissionRequest;
          sessionID?: string;
          status?: SessionStatus;
          info?: { id?: string };
        };
      };
      if (evt.type === 'permission.updated' && evt.properties?.permission) {
        handlePermissionRequest(evt.properties.permission);
      } else if (
        evt.type === 'session.status' &&
        evt.properties?.sessionID &&
        evt.properties?.status
      ) {
        sessionStatuses.set(evt.properties.sessionID, evt.properties.status);
        updateStatusBar();
      } else if (evt.type === 'session.deleted' && evt.properties?.info?.id) {
        // Clean up status of deleted sessions to prevent unbounded map growth
        sessionStatuses.delete(evt.properties.info.id);
        updateStatusBar();
      } else if (evt.type === 'lsp.updated') {
        void syncMetadata();
      }
    });
    context.subscriptions.push({ dispose: unsubscribeEvents });

    registerExtensionCommands(context, ipc, provider, handleCreateSession, handleSelectHistory);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    window.showErrorMessage(`OpenCode Sidebar activation failed: ${message}`);
  }
}

/**
 * Shows a VS Code modal dialog for permission requests (Allow/Deny).
 */
function handlePermissionRequest(permission: PermissionRequest): void {
  window
    .showInformationMessage(
      `OpenCode Permission: ${permission.permission}`,
      { modal: false },
      'Allow',
      'Deny',
    )
    .then((choice) => {
      if (choice === 'Allow') {
        void sdk.permission.reply(permission.id, true);
      } else if (choice === 'Deny') {
        void sdk.permission.reply(permission.id, false);
      }
    });
}
