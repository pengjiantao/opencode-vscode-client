/**
 * @file Reusable helpers for session history management.
 * Provides confirmation dialogs and fallback session switching logic.
 */

import type { SessionStatus } from '@opencode-ai/sdk/v2/client';
import { window } from 'vscode';
import type { IPCBridge } from './ipc';
import { getMessagesAndPartsRecursive, handleCreateSession } from './session-handlers';
import type { SessionManager } from './session-manager';
import type { SessionStateStore } from './session-state-store';
import type { AgentInfo, ModelInfo } from './types';

/**
 * Prompts the user with a QuickPick confirmation dialog (Yes/No).
 * Prevents visual drift and reduces keyboard/mouse movement overhead.
 *
 * @param placeHolder The confirmation question/placeholder.
 * @param title Optional title for the quick pick.
 * @returns A promise resolving to true if confirmed, false otherwise.
 */
export async function confirmAction(placeHolder: string, title?: string): Promise<boolean> {
  const result = await window.showQuickPick(['Yes', 'No'], {
    placeHolder,
    title,
    ignoreFocusOut: true,
  });
  return result === 'Yes';
}

/** Interface for ensureActiveSessionFallback options. */
export interface FallbackOptions {
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
  /** Map of session IDs to their active processing statuses. */
  sessionStatuses: Map<string, SessionStatus>;
}

/**
 * Ensures that if the active session was closed, archived, or deleted,
 * we switch to another open session or create a fallback session.
 *
 * @param options Parameters required to execute fallback switching.
 */
export async function ensureActiveSessionFallback({
  sessionManager,
  sessionStateStore,
  cachedModels,
  cachedAgents,
  ipc,
  syncPendingRequests,
  sessionStatuses,
}: FallbackOptions): Promise<void> {
  const nextOpenIDs = sessionManager.getOpenSessionIDs();
  if (nextOpenIDs.length > 0) {
    const nextActiveID = sessionManager.activeSessionID;
    if (nextActiveID) {
      const nextState = sessionStateStore.getOrInitialize(nextActiveID, cachedModels, cachedAgents);
      ipc.send({
        type: 'session:switched',
        sessionID: nextActiveID,
        model: nextState.model,
        agent: nextState.agent,
        modelVariants: nextState.modelVariants,
      });
      const { messages, parts } = await getMessagesAndPartsRecursive(sessionManager, nextActiveID);
      ipc.send({
        type: 'messages:list',
        sessionID: nextActiveID,
        messages,
        parts,
        status: sessionStatuses.get(nextActiveID),
      });
      syncPendingRequests(nextActiveID);
    }
  } else {
    await handleCreateSession({
      sessionManager,
      sessionStateStore,
      cachedModels,
      cachedAgents,
      ipc,
      syncPendingRequests,
    });
  }
}
