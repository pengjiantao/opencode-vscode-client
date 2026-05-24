/**
 * @file Registers IPC handlers that persist per-session model, agent, and variant state.
 */

import type { IPCBridge } from './ipc';
import type { SessionManager } from './session-manager';
import type { SessionState, SessionStateStore } from './session-state-store';
import type { AgentInfo, ModelInfo } from './types';

/** Options required to register session state IPC handlers. */
interface RegisterSessionStateHandlersOptions {
  /** The IPC bridge receiving webview messages. */
  ipc: IPCBridge;
  /** Session lifecycle manager used to resolve the active session fallback. */
  sessionManager: SessionManager;
  /** Persistent per-session state store. */
  sessionStateStore: SessionStateStore;
  /** Cached language models used when initializing missing session state. */
  getCachedModels: () => ModelInfo[];
  /** Cached agents used when initializing missing session state. */
  getCachedAgents: () => AgentInfo[];
  /** Metadata sync callback triggered after model or agent changes. */
  syncMetadata: () => void;
}

/** Registers model, agent, and variant switch handlers with session-aware persistence. */
export function registerSessionStateHandlers({
  ipc,
  sessionManager,
  sessionStateStore,
  getCachedModels,
  getCachedAgents,
  syncMetadata,
}: RegisterSessionStateHandlersOptions): void {
  const updateSessionState = (
    sessionID: string | undefined,
    callback: (state: SessionState) => void,
  ): void => {
    const targetSessionID = sessionID || sessionManager.activeSessionID;
    if (!targetSessionID) return;

    const state = sessionStateStore.getOrInitialize(
      targetSessionID,
      getCachedModels(),
      getCachedAgents(),
    );
    callback(state);
    sessionStateStore.set(targetSessionID, state);
  };

  ipc.on('model:switch', (msg) => {
    const { model, sessionID } = msg as { model: string; sessionID?: string };
    updateSessionState(sessionID, (state) => {
      state.model = model || '';
    });
    syncMetadata();
  });

  ipc.on('agent:switch', (msg) => {
    const { agent, sessionID } = msg as { agent: string; sessionID?: string };
    updateSessionState(sessionID, (state) => {
      state.agent = agent || '';
    });
    syncMetadata();
  });

  ipc.on('variant:switch', (msg) => {
    const { model, variant, sessionID } = msg as {
      model: string;
      variant: string;
      sessionID?: string;
    };
    if (!model) return;

    updateSessionState(sessionID, (state) => {
      state.modelVariants[model] = variant || 'default';
    });
  });
}
