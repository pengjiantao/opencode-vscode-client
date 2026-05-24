/**
 * @file VS Code extension activation entry point.
 * Initializes SDK client, session manager, IPC bridge, and webview provider.
 * Registers all IPC message handlers for session lifecycle and prompt operations.
 */

import type {
  Part,
  PermissionRequest,
  QuestionRequest,
  SessionStatus,
} from '@opencode-ai/sdk/v2/client';
import { window, workspace, type ExtensionContext } from 'vscode';
import { pasteClipboardTextAsPlainText, registerExtensionCommands } from './commands';
import { IPCBridge } from './ipc';
import { syncMetadata as importSyncMetadata } from './metadata';
import { PendingRequestBuffer } from './pending-request-buffer';
import type { SDKClient } from './sdk-client';
import { createSDKClient } from './sdk-client-impl';
import { handleCreateSession, handleSelectHistory } from './session-handlers';
import { SessionManager } from './session-manager';
import { SessionStateStore, type SessionState } from './session-state-store';
import { StatusBarManager } from './status-bar';
import type { AgentInfo, ExtToWebview, ModelInfo } from './types';
import { handleCommandPart } from './utils/command-router';
import { registerFileHandlers } from './utils/fileHandlers';
import { OpencodeSidebarViewProvider } from './webview-provider';

let sdk: SDKClient;
let sessionManager: SessionManager;
let ipc: IPCBridge;
let provider: OpencodeSidebarViewProvider;

/**
 * Activates the OpenCode sidebar extension.
 * Sets up SDK connection, IPC bridges, and registers handlers for lifecycle events.
 *
 * @param context VS Code ExtensionContext.
 */
export async function activate(context: ExtensionContext): Promise<void> {
  const sessionStateStore = new SessionStateStore(context.globalState);
  const sessionStatuses = new Map<string, SessionStatus>();
  const pendingBuffer = new PendingRequestBuffer();
  let cachedModels: ModelInfo[] = [];
  let cachedAgents: AgentInfo[] = [];

  /** Sends the current session's pending requests to the webview. */
  const syncPendingRequests = (sessionID: string): void => {
    const { permissions, questions } = pendingBuffer.getBySession(sessionID);
    ipc.send({
      type: 'pending-requests',
      sessionID,
      permissions,
      questions,
    });
  };

  /** Calls the extracted handleCreateSession command handler. */
  const invokeCreateSession = async (): Promise<void> => {
    await handleCreateSession({
      sessionManager,
      context,
      sessionStateStore,
      cachedModels,
      cachedAgents,
      ipc,
      syncPendingRequests,
    });
  };

  /** Calls the extracted handleSelectHistory command handler. */
  const invokeSelectHistory = async (): Promise<void> => {
    await handleSelectHistory({
      sdk,
      sessionManager,
      context,
      sessionStateStore,
      cachedModels,
      cachedAgents,
      ipc,
      syncPendingRequests,
    });
  };

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

    // Initialize native status bar item to show current session processing status via StatusBarManager
    const statusBarManager = new StatusBarManager(context, sessionManager, sessionStatuses);

    const serverHandle = await sessionManager.connect();
    // Register the server cleanup disposable to terminate the server process on extension deactivation/window close
    context.subscriptions.push({
      dispose: () => {
        try {
          serverHandle.close();
        } catch (err) {
          console.error('Failed to close OpenCode server on deactivation:', err);
        }
      },
    });

    context.subscriptions.push(
      window.registerWebviewViewProvider('opencode-sidebar.main', provider),
    );

    /** Handles webview initialization: loads sessions, messages, models, and agents. */
    ipc.on('init', async () => {
      try {
        const [models, agents] = await Promise.all([sdk.getModels(), sdk.getAgents()]);
        cachedModels = models;
        cachedAgents = agents;
        ipc.send({ type: 'models:list', models });
        ipc.send({ type: 'agents:list', agents });
      } catch (err) {
        console.error('Failed to load models or agents:', err);
      }

      try {
        const sessions = await sdk.session.list();
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
          const session = await sessionManager.create();
          openIDs = [session.id];
          await context.workspaceState.update('openSessionIDs', openIDs);

          const state = sessionStateStore.getOrInitialize(session.id, cachedModels, cachedAgents);
          ipc.send({
            type: 'init',
            sessions: [session],
          });
          ipc.send({
            type: 'session:switched',
            sessionID: session.id,
            model: state.model,
            agent: state.agent,
            modelVariants: state.modelVariants,
          });
          ipc.send({ type: 'messages:list', sessionID: session.id, messages: [], parts: [] });
          syncPendingRequests(session.id);
        } else {
          sessionManager.switch(activeID);
          await context.workspaceState.update('openSessionIDs', openIDs);

          // Migrate legacy configuration into the active session.
          sessionStateStore.migrateLegacyState(activeID);

          const openSessions = activeSessions.filter((s) => openIDs.includes(s.id));
          const state = sessionStateStore.getOrInitialize(activeID, cachedModels, cachedAgents);
          ipc.send({
            type: 'init',
            sessions: openSessions,
          });
          ipc.send({
            type: 'session:switched',
            sessionID: activeID,
            model: state.model,
            agent: state.agent,
            modelVariants: state.modelVariants,
          });

          const { messages, parts } = await sessionManager.getMessagesAndParts(activeID);
          ipc.send({ type: 'messages:list', sessionID: activeID, messages, parts });
          syncPendingRequests(activeID);
        }
      } catch (err) {
        console.error('Failed to load session list on init:', err);
      } finally {
        void syncMetadata();
      }
    });

    ipc.on('session:create', () => {
      void invokeCreateSession();
    });

    ipc.on('session:switch', async (msg) => {
      const { sessionID } = msg as { sessionID: string };
      try {
        sessionManager.switch(sessionID);
        const state = sessionStateStore.getOrInitialize(sessionID, cachedModels, cachedAgents);
        ipc.send({
          type: 'session:switched',
          sessionID,
          model: state.model,
          agent: state.agent,
          modelVariants: state.modelVariants,
        });
        const { messages, parts } = await sessionManager.getMessagesAndParts(sessionID);
        ipc.send({ type: 'messages:list', sessionID, messages, parts });
        void syncMetadata();
        syncPendingRequests(sessionID);
      } catch (err) {
        ipc.send({ type: 'error', message: (err as Error).message });
      }
    });

    ipc.on('session:archive', async (msg) => {
      const { sessionID } = msg as { sessionID: string };
      sessionStateStore.delete(sessionID);
      // Delete session status to prevent unbounded map growth
      sessionStatuses.delete(sessionID);
      pendingBuffer.removeBySession(sessionID);
      const previousActiveID = sessionManager.activeSessionID;
      try {
        await sessionManager.archive(sessionID);
        let openIDs = context.workspaceState.get<string[]>('openSessionIDs') || [];
        openIDs = openIDs.filter((id) => id !== sessionID);
        await context.workspaceState.update('openSessionIDs', openIDs);

        ipc.send({ type: 'session:archived', sessionID });

        if (previousActiveID === sessionID) {
          if (openIDs.length > 0) {
            const nextActiveID = openIDs[openIDs.length - 1];
            sessionManager.switch(nextActiveID);
            const state = sessionStateStore.getOrInitialize(
              nextActiveID,
              cachedModels,
              cachedAgents,
            );
            ipc.send({
              type: 'session:switched',
              sessionID: nextActiveID,
              model: state.model,
              agent: state.agent,
              modelVariants: state.modelVariants,
            });
            const { messages, parts } = await sessionManager.getMessagesAndParts(nextActiveID);
            ipc.send({ type: 'messages:list', sessionID: nextActiveID, messages, parts });
            syncPendingRequests(nextActiveID);
          } else {
            await invokeCreateSession();
          }
        }
      } catch (err) {
        ipc.send({ type: 'error', message: (err as Error).message });
      }
    });

    ipc.on('session:close', async (msg) => {
      const { sessionID } = msg as { sessionID: string };
      // Delete session status to prevent unbounded map growth
      sessionStatuses.delete(sessionID);
      pendingBuffer.removeBySession(sessionID);
      const previousActiveID = sessionManager.activeSessionID;

      let openIDs = context.workspaceState.get<string[]>('openSessionIDs') || [];
      openIDs = openIDs.filter((id) => id !== sessionID);
      await context.workspaceState.update('openSessionIDs', openIDs);

      ipc.send({ type: 'session:deleted', sessionID });

      if (openIDs.length === 0) {
        await invokeCreateSession();
        return;
      }

      if (previousActiveID === sessionID) {
        const nextActiveID = openIDs[openIDs.length - 1];
        sessionManager.switch(nextActiveID);
        const state = sessionStateStore.getOrInitialize(nextActiveID, cachedModels, cachedAgents);
        ipc.send({
          type: 'session:switched',
          sessionID: nextActiveID,
          model: state.model,
          agent: state.agent,
          modelVariants: state.modelVariants,
        });
        const { messages, parts } = await sessionManager.getMessagesAndParts(nextActiveID);
        ipc.send({ type: 'messages:list', sessionID: nextActiveID, messages, parts });
        syncPendingRequests(nextActiveID);
      }
    });

    ipc.on('session:close-all', () => {
      // Clear all statuses to prevent memory leaks and unbounded map growth
      sessionStatuses.clear();
      pendingBuffer.clear();
      void context.workspaceState.update('openSessionIDs', []);
      ipc.send({ type: 'init', sessions: [] });
      void invokeCreateSession();
    });

    ipc.on('sessions:select-history', () => {
      void invokeSelectHistory();
    });

    ipc.on('clipboard:paste-plain-text', () => {
      void pasteClipboardTextAsPlainText(ipc);
    });

    ipc.on('prompt:send', (msg) => {
      const { text, parts } = msg as { text?: string; parts?: Part[] };
      const activeID = sessionManager.activeSessionID;
      if (!activeID) {
        ipc.send({ type: 'error', message: 'No active session' });
        return;
      }

      const sessionState = sessionStateStore.getOrInitialize(activeID, cachedModels, cachedAgents);
      // Resolve the active variant for the currently selected model
      const activeVariant = sessionState.model
        ? sessionState.modelVariants[sessionState.model] || 'default'
        : 'default';
      const sdkVariant = activeVariant === 'default' ? undefined : activeVariant;

      // Detect command parts and route to the dedicated command execution endpoint
      const handled = handleCommandPart({
        parts,
        text,
        activeID,
        activeModel: sessionState.model || undefined,
        activeAgent: sessionState.agent || undefined,
        activeVariant: sdkVariant,
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

      sessionManager
        .sendPrompt(
          activeID,
          promptParts,
          sessionState.model || undefined,
          sessionState.agent || undefined,
          sdkVariant,
        )
        .catch((err) => {
          ipc.send({ type: 'error', message: (err as Error).message });
        });
    });

    const handlePromise = (promise: Promise<unknown>, errorPrefix: string): void => {
      promise.catch((err) => {
        ipc.send({ type: 'error', message: `${errorPrefix}: ${(err as Error).message}` });
      });
    };

    const updateSessionState = (callback: (state: SessionState) => void): void => {
      const activeID = sessionManager.activeSessionID;
      if (activeID) {
        const state = sessionStateStore.getOrInitialize(activeID, cachedModels, cachedAgents);
        callback(state);
        sessionStateStore.set(activeID, state);
      }
    };

    registerFileHandlers(ipc);

    ipc.on('prompt:abort', (msg) => {
      const { sessionID } = msg as { sessionID: string };
      handlePromise(sessionManager.abort(sessionID), 'Abort failed');
    });

    ipc.on('model:switch', (msg) => {
      const { model } = msg as { model: string };
      updateSessionState((state) => {
        state.model = model || '';
      });
      void syncMetadata();
    });

    ipc.on('agent:switch', (msg) => {
      const { agent } = msg as { agent: string };
      updateSessionState((state) => {
        state.agent = agent || '';
      });
      void syncMetadata();
    });

    ipc.on('variant:switch', (msg) => {
      const { model, variant } = msg as { model: string; variant: string };
      if (model) {
        updateSessionState((state) => {
          state.modelVariants[model] = variant || 'default';
        });
      }
    });

    ipc.on('permission:reply', (msg) => {
      const { permissionID, allow, reply } = msg as {
        permissionID: string;
        allow?: boolean;
        reply?: 'once' | 'always' | 'reject';
      };
      const replyValue = reply || (allow ? 'once' : 'reject');
      pendingBuffer.removePermission(permissionID);
      handlePromise(sdk.permission.reply(permissionID, replyValue), 'Permission reply failed');
    });

    ipc.on('question:reply', (msg) => {
      const { requestID, answers } = msg as { requestID: string; answers: string[][] };
      pendingBuffer.removeQuestion(requestID);
      handlePromise(sdk.question.reply(requestID, answers), 'Question reply failed');
    });

    ipc.on('question:reject', (msg) => {
      const { requestID } = msg as { requestID: string };
      pendingBuffer.removeQuestion(requestID);
      handlePromise(sdk.question.reject(requestID), 'Question reject failed');
    });

    // Subscribe to events and register disposable to prevent memory leaks
    const unsubscribeEvents = sdk.subscribeEvents((event: unknown) => {
      const evt = event as {
        type?: string;
        properties?: { sessionID?: string; status?: SessionStatus; info?: { id?: string } };
      };

      if (evt.type === 'permission.asked') {
        pendingBuffer.addPermission(evt.properties as unknown as PermissionRequest);
      } else if (evt.type === 'permission.replied') {
        const permID = (evt.properties as unknown as { requestID: string })?.requestID;
        if (permID) {
          pendingBuffer.removePermission(permID);
        }
      } else if (evt.type === 'question.asked') {
        pendingBuffer.addQuestion(evt.properties as unknown as QuestionRequest);
      } else if (evt.type === 'question.replied' || evt.type === 'question.rejected') {
        const reqID = (evt.properties as unknown as { requestID: string })?.requestID;
        if (reqID) {
          pendingBuffer.removeQuestion(reqID);
        }
      }

      // Forward SSE events to webview
      ipc.send({ type: 'event:received', event } as ExtToWebview);

      if (evt.type === 'session.status' && evt.properties?.sessionID && evt.properties?.status) {
        sessionStatuses.set(evt.properties.sessionID, evt.properties.status);
        statusBarManager.update();
      } else if (evt.type === 'session.deleted' && evt.properties?.info?.id) {
        // Clean up status of deleted sessions to prevent unbounded map growth
        sessionStatuses.delete(evt.properties.info.id);
        statusBarManager.update();
      } else if (evt.type === 'lsp.updated') {
        void syncMetadata();
      }
    });
    context.subscriptions.push({ dispose: unsubscribeEvents });

    ipc.on('sync-pending-requests', () => {
      const activeID = sessionManager.activeSessionID;
      if (activeID) {
        syncPendingRequests(activeID);
      }
    });

    registerExtensionCommands(
      context,
      ipc,
      provider,
      () => void invokeCreateSession(),
      () => void invokeSelectHistory(),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    window.showErrorMessage(`OpenCode Sidebar activation failed: ${message}`);
  }
}
