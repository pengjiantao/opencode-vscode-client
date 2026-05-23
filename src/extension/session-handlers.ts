/**
 * @file Handlers for session lifecycle operations like creation and history selection.
 * Keeps index.ts focused and complies with file length limitations.
 */

import { window, type ExtensionContext } from 'vscode';
import type { IPCBridge } from './ipc';
import type { SDKClient } from './sdk-client';
import type { SessionManager } from './session-manager';
import type { SessionStateStore } from './session-state-store';
import type { AgentInfo, ModelInfo } from './types';

/** Options for handleCreateSession function. */
interface CreateSessionOptions {
  /** The extension session manager. */
  sessionManager: SessionManager;
  /** The VS Code extension context. */
  context: ExtensionContext;
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
  /** The VS Code extension context. */
  context: ExtensionContext;
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
  context,
  sessionStateStore,
  cachedModels,
  cachedAgents,
  ipc,
  syncPendingRequests,
}: CreateSessionOptions): Promise<void> {
  try {
    const session = await sessionManager.create();
    const openIDs = context.workspaceState.get<string[]>('openSessionIDs') || [];
    if (!openIDs.includes(session.id)) {
      openIDs.push(session.id);
      await context.workspaceState.update('openSessionIDs', openIDs);
    }
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
  context,
  sessionStateStore,
  cachedModels,
  cachedAgents,
  ipc,
  syncPendingRequests,
}: SelectHistoryOptions): Promise<void> {
  try {
    const sessions = await sdk.session.list();
    const activeSessions = sessions.filter((s) => !(s.time as { archived?: unknown }).archived);
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
    const openIDs = context.workspaceState.get<string[]>('openSessionIDs') || [];

    if (!openIDs.includes(sessionID)) {
      openIDs.push(sessionID);
      await context.workspaceState.update('openSessionIDs', openIDs);
      ipc.send({ type: 'session:created', session: selected.session });
    }

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
    syncPendingRequests(sessionID);
  } catch (err) {
    void window.showErrorMessage(`Failed to retrieve session history: ${(err as Error).message}`);
  }
}
