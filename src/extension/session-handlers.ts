/**
 * @file Handlers for session lifecycle operations like creation and history selection.
 * Keeps index.ts focused and complies with file length limitations.
 */

import type { SessionStatus } from '@opencode-ai/sdk/v2/client';
import { window } from 'vscode';
import type { IPCBridge } from './ipc';
import type { PendingRequestBuffer } from './pending-request-buffer';
import type { SDKClient } from './sdk-client';
import type { SessionManager } from './session-manager';
import type { SessionRelationTracker } from './session-relation-tracker';
import type { SessionStateStore } from './session-state-store';
import type { AgentInfo, ModelInfo } from './types';

/** Options for handleCreateSession function. */
interface CreateSessionOptions {
  /** The extension session manager. */
  sessionManager: SessionManager;
  /** Store for per-session configurations. */
  sessionStateStore: SessionStateStore;
  /** Cached language models. */
  cachedModels: ModelInfo[];
  /** Cached agents. */
  cachedAgents: AgentInfo[];
  /** The IPC bridge to communicate with the webview. */
  ipc: IPCBridge;
  /** Callback to sync pending requests for the session. */
  syncPendingRequests: (sessionID: string) => void;
}

/** Options for handleSelectHistory function. */
interface SelectHistoryOptions {
  /** The SDK client. */
  sdk: SDKClient;
  /** The extension session manager. */
  sessionManager: SessionManager;
  /** Store for per-session configurations. */
  sessionStateStore: SessionStateStore;
  /** Cached language models. */
  cachedModels: ModelInfo[];
  /** Cached agents. */
  cachedAgents: AgentInfo[];
  /** The IPC bridge to communicate with the webview. */
  ipc: IPCBridge;
  /** Callback to sync pending requests for the session. */
  syncPendingRequests: (sessionID: string) => void;
}

/**
 * Creates a new session, registers its ID in the workspace state,
 * triggers session switch IPC notifications, and syncs pending requests.
 *
 * @param options Parameters required to execute session creation.
 */
export async function handleCreateSession({
  sessionManager,
  sessionStateStore,
  cachedModels,
  cachedAgents,
  ipc,
  syncPendingRequests,
}: CreateSessionOptions): Promise<void> {
  try {
    const session = await sessionManager.create();
    const state = sessionStateStore.getOrInitialize(session.id, cachedModels, cachedAgents);
    ipc.send({ type: 'session:created', session });
    ipc.send({
      type: 'session:switched',
      sessionID: session.id,
      model: state.model,
      agent: state.agent,
      modelVariants: state.modelVariants,
    });
    ipc.send({ type: 'messages:list', sessionID: session.id, messages: [], parts: [] });
    syncPendingRequests(session.id);
  } catch (err) {
    ipc.send({ type: 'error', message: (err as Error).message });
  }
}

/**
 * Shows a QuickPick dialog for selecting historical sessions, opens the selected
 * session, switches to it, lists its messages, and synchronizes its pending requests.
 *
 * @param options Parameters required to execute history selection.
 */
export async function handleSelectHistory({
  sdk,
  sessionManager,
  sessionStateStore,
  cachedModels,
  cachedAgents,
  ipc,
  syncPendingRequests,
}: SelectHistoryOptions): Promise<void> {
  try {
    const sessions = await sdk.session.list();
    const activeSessions = sessions.filter(
      (s) => !(s.time as { archived?: unknown }).archived && !s.parentID,
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

    const selected = await window.showQuickPick(items, {
      placeHolder: 'Select a previous session to open',
      title: 'OpenCode Session History',
    });
    if (!selected) return;

    const sessionID = selected.sessionID;
    const openIDs = sessionManager.getOpenSessionIDs();

    if (!openIDs.includes(sessionID)) {
      openIDs.push(sessionID);
      await sessionManager.setOpenSessionIDs(openIDs);
      ipc.send({ type: 'session:created', session: selected.session });
    }

    await sessionManager.switch(sessionID);
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
    syncPendingRequests(sessionID);
  } catch (err) {
    void window.showErrorMessage(`Failed to retrieve session history: ${(err as Error).message}`);
  }
}

/** Options required to register session lifecycle IPC message handlers. */
export interface RegisterLifecycleHandlersOptions {
  /** IPC bridge receiving messages from the webview. */
  ipc: IPCBridge;
  /** Session lifecycle manager. */
  sessionManager: SessionManager;
  /** State store for per-session configuration parameters. */
  sessionStateStore: SessionStateStore;
  /** Supplier function for cached language models. */
  getCachedModels: () => ModelInfo[];
  /** Supplier function for cached agents. */
  getCachedAgents: () => AgentInfo[];
  /** Callback to sync LSP/MCP metadata to the webview. */
  syncMetadata: () => void;
  /** Callback to sync pending permission/question requests for a session. */
  syncPendingRequests: (sessionID: string) => void;
  /** Map of session IDs to their active processing statuses. */
  sessionStatuses: Map<string, SessionStatus>;
  /** Buffer of pending requests in the extension. */
  pendingBuffer: PendingRequestBuffer;
  /** Relationship tracker for child session resolution. */
  relationTracker: SessionRelationTracker;
  /** Helper command to automatically create a fallback session. */
  invokeCreateSession: () => Promise<void>;
}

/**
 * Registers IPC handlers for session:switch, session:archive, session:close, and session:close-all.
 * Handles the visual UI state shifts and state updates between active tabs.
 *
 * @param options Registration dependencies.
 */
export function registerSessionLifecycleHandlers({
  ipc,
  sessionManager,
  sessionStateStore,
  getCachedModels,
  getCachedAgents,
  syncMetadata,
  syncPendingRequests,
  sessionStatuses,
  pendingBuffer,
  relationTracker,
  invokeCreateSession,
}: RegisterLifecycleHandlersOptions): void {
  ipc.on('session:switch', async (msg) => {
    const { sessionID } = msg as { sessionID: string };
    try {
      await sessionManager.switch(sessionID);
      const state = sessionStateStore.getOrInitialize(
        sessionID,
        getCachedModels(),
        getCachedAgents(),
      );
      ipc.send({
        type: 'session:switched',
        sessionID,
        model: state.model,
        agent: state.agent,
        modelVariants: state.modelVariants,
      });
      const { messages, parts } = await sessionManager.getMessagesAndParts(sessionID);
      ipc.send({
        type: 'messages:list',
        sessionID,
        messages,
        parts,
        status: sessionStatuses.get(sessionID),
      });
      void syncMetadata();
      syncPendingRequests(sessionID);
    } catch (err) {
      ipc.send({ type: 'error', message: (err as Error).message });
    }
  });

  ipc.on('session:archive', async (msg) => {
    const { sessionID } = msg as { sessionID: string };
    sessionStateStore.delete(sessionID);
    sessionStatuses.delete(sessionID);
    pendingBuffer.removeBySession(sessionID);
    relationTracker.clean(sessionID);
    const previousActiveID = sessionManager.activeSessionID;
    try {
      await sessionManager.archive(sessionID);
      ipc.send({ type: 'session:archived', sessionID });

      if (previousActiveID === sessionID) {
        const openIDs = sessionManager.getOpenSessionIDs();
        if (openIDs.length > 0) {
          const nextActiveID = sessionManager.activeSessionID!;
          const state = sessionStateStore.getOrInitialize(
            nextActiveID,
            getCachedModels(),
            getCachedAgents(),
          );
          ipc.send({
            type: 'session:switched',
            sessionID: nextActiveID,
            model: state.model,
            agent: state.agent,
            modelVariants: state.modelVariants,
          });
          const { messages, parts } = await sessionManager.getMessagesAndParts(nextActiveID);
          ipc.send({
            type: 'messages:list',
            sessionID: nextActiveID,
            messages,
            parts,
            status: sessionStatuses.get(nextActiveID),
          });
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
    sessionStatuses.delete(sessionID);
    pendingBuffer.removeBySession(sessionID);
    relationTracker.clean(sessionID);
    const previousActiveID = sessionManager.activeSessionID;

    await sessionManager.close(sessionID);

    ipc.send({ type: 'session:deleted', sessionID });

    const openIDs = sessionManager.getOpenSessionIDs();
    if (openIDs.length === 0) {
      await invokeCreateSession();
      return;
    }

    if (previousActiveID === sessionID) {
      const nextActiveID = sessionManager.activeSessionID!;
      const state = sessionStateStore.getOrInitialize(
        nextActiveID,
        getCachedModels(),
        getCachedAgents(),
      );
      ipc.send({
        type: 'session:switched',
        sessionID: nextActiveID,
        model: state.model,
        agent: state.agent,
        modelVariants: state.modelVariants,
      });
      const { messages, parts } = await sessionManager.getMessagesAndParts(nextActiveID);
      ipc.send({
        type: 'messages:list',
        sessionID: nextActiveID,
        messages,
        parts,
        status: sessionStatuses.get(nextActiveID),
      });
      syncPendingRequests(nextActiveID);
    }
  });

  ipc.on('session:close-all', () => {
    sessionStatuses.clear();
    pendingBuffer.clear();
    relationTracker.clear();
    void sessionManager.closeAll();
    ipc.send({ type: 'init', sessions: [] });
    void invokeCreateSession();
  });
}
