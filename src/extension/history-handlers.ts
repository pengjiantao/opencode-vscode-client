/**
 * @file Handlers for session history management.
 * Provides custom QuickPick controls, batch options, and individual item actions.
 */

import type { Session, SessionStatus } from '@opencode-ai/sdk/v2/client';
import { ThemeIcon, window, type QuickInputButton, type QuickPickItem } from 'vscode';
import { confirmAction, ensureActiveSessionFallback } from './history-helpers';
import type { IPCBridge } from './ipc';
import type { PendingRequestBuffer } from './pending-request-buffer';
import type { SDKClient } from './sdk-client';
import type { SessionManager } from './session-manager';
import type { SessionRelationTracker } from './session-relation-tracker';
import type { SessionStateStore } from './session-state-store';
import type { AgentInfo, ModelInfo } from './types';

/** Milliseconds in 30 days. */
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Extended QuickPickItem representing a historical session. */
export interface HistoryQuickPickItem extends QuickPickItem {
  /** The session ID. */
  sessionID: string;
  /** The underlying SDK session object. */
  session: Session;
}

/** Options for handleSelectHistory function. */
export interface SelectHistoryOptions {
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
  /** Map of session IDs to their active processing statuses. */
  sessionStatuses: Map<string, SessionStatus>;
  /** Buffer of pending requests in the extension. */
  pendingBuffer: PendingRequestBuffer;
  /** Relationship tracker for child session resolution. */
  relationTracker: SessionRelationTracker;
}

/**
 * Shows an interactive QuickPick dialog for session history selection.
 * Supports individual item archiving/deletion and batch title bar operations.
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
  sessionStatuses,
  pendingBuffer,
  relationTracker,
}: SelectHistoryOptions): Promise<void> {
  const quickPick = window.createQuickPick<HistoryQuickPickItem>();
  quickPick.title = 'OpenCode Session History';
  quickPick.placeholder = 'Loading session history...';

  // State to track if archived sessions should be included in the list
  let showArchived = false;

  // Define batch operation buttons on the QuickPick header
  const deleteEmptyButton: QuickInputButton = {
    iconPath: new ThemeIcon('clear-all'),
    tooltip: 'Delete Empty Sessions (except open)',
  };
  const archiveOldButton: QuickInputButton = {
    iconPath: new ThemeIcon('archive'),
    tooltip: 'Archive Sessions Older than 30 Days',
  };
  const cleanArchivedButton: QuickInputButton = {
    iconPath: new ThemeIcon('trash'),
    tooltip: 'Delete All Archived Sessions',
  };

  /**
   * Refreshes/updates the list of buttons on the QuickPick header title bar.
   * Modifies buttons dynamically to reflect state changes (e.g., showArchived status).
   */
  const updateTitleButtons = (): void => {
    const toggleArchivedButton: QuickInputButton = {
      iconPath: new ThemeIcon(showArchived ? 'eye-closed' : 'eye'),
      tooltip: showArchived ? 'Hide Archived Sessions' : 'Show Archived Sessions',
    };
    quickPick.buttons = [
      deleteEmptyButton,
      archiveOldButton,
      toggleArchivedButton,
      cleanArchivedButton,
    ];
  };

  /**
   * Asynchronously loads sessions from the SDK, filters out sub-agent sessions,
   * sorts them by last updated timestamp, and renders them in the QuickPick UI.
   */
  const loadSessions = async (): Promise<void> => {
    try {
      const sessions = await sdk.session.list();

      // Sub-agent sessions should never be presented in the main history list
      let filtered = sessions.filter((s) => !s.parentID);

      if (!showArchived) {
        filtered = filtered.filter((s) => !s.time.archived);
      }

      // Sort with most recently active sessions at the top
      const sorted = [...filtered].sort((a, b) => (b.time?.updated || 0) - (a.time?.updated || 0));

      const items: HistoryQuickPickItem[] = sorted.map((s) => {
        const isArchived = !!s.time.archived;
        const prefix = isArchived ? '[Archived] ' : '';

        const archiveItemButton: QuickInputButton = isArchived
          ? { iconPath: new ThemeIcon('history'), tooltip: 'Unarchive Session' }
          : { iconPath: new ThemeIcon('archive'), tooltip: 'Archive Session' };

        const deleteItemButton: QuickInputButton = {
          iconPath: new ThemeIcon('trash'),
          tooltip: 'Delete Session',
        };

        return {
          label: `${prefix}${s.title || 'Untitled Session'}`,
          description: new Date(s.time.updated || s.time.created).toLocaleString(),
          sessionID: s.id,
          session: s,
          buttons: [archiveItemButton, deleteItemButton],
        };
      });

      quickPick.items = items;

      // Pre-select the currently active session in the list
      const activeSessionID = sessionManager.activeSessionID;
      if (activeSessionID) {
        const activeItem = items.find((item) => item.sessionID === activeSessionID);
        if (activeItem) {
          quickPick.activeItems = [activeItem];
        }
      }

      quickPick.placeholder =
        items.length === 0 ? 'No previous sessions found.' : 'Select a previous session to open';
    } catch (err) {
      void window.showErrorMessage(`Failed to retrieve session history: ${(err as Error).message}`);
    }
  };

  // Set initial buttons and fetch sessions
  updateTitleButtons();
  quickPick.show();
  await loadSessions();

  // Handle switching/opening a session when selected from the list
  quickPick.onDidAccept(async () => {
    const selected = quickPick.selectedItems[0];
    if (!selected) return;

    quickPick.hide();

    const sessionID = selected.sessionID;
    const openIDs = sessionManager.getOpenSessionIDs();

    try {
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
      ipc.send({
        type: 'messages:list',
        sessionID,
        messages,
        parts,
        status: sessionStatuses.get(sessionID),
      });
      syncPendingRequests(sessionID);
    } catch (err) {
      void window.showErrorMessage(`Failed to open session: ${(err as Error).message}`);
    }
  });

  // Handle individual item action buttons (Archive/Unarchive/Delete)
  quickPick.onDidTriggerItemButton(async (e) => {
    const sessionID = e.item.sessionID;
    const tooltip = e.button.tooltip;

    // Check if session is currently open (active tab) or busy executing a background task
    const openIDs = sessionManager.getOpenSessionIDs();
    const isOpen = openIDs.includes(sessionID);
    const status = sessionStatuses.get(sessionID);
    const isRunning = status && (status.type === 'busy' || status.type === 'retry');

    if (tooltip === 'Archive Session') {
      // Require confirmation if the session is currently active or running a task
      if (isOpen || isRunning) {
        const message = isRunning
          ? 'The session is currently running. Archiving it will abort any running task. Are you sure you want to archive it?'
          : 'The session is currently open. Are you sure you want to archive it?';
        const confirm = await confirmAction(message, 'Confirm Archive');
        if (!confirm) {
          return;
        }
      }

      try {
        sessionStateStore.delete(sessionID);
        sessionStatuses.delete(sessionID);
        pendingBuffer.removeBySession(sessionID);
        relationTracker.clean(sessionID);

        const previousActiveID = sessionManager.activeSessionID;
        await sessionManager.archive(sessionID);
        ipc.send({ type: 'session:archived', sessionID });

        // If the archived session was the active one, switch focus to another or fallback
        if (previousActiveID === sessionID) {
          await ensureActiveSessionFallback({
            sessionManager,
            sessionStateStore,
            cachedModels,
            cachedAgents,
            ipc,
            syncPendingRequests,
            sessionStatuses,
          });
        }
        await loadSessions();
      } catch (err) {
        void window.showErrorMessage(`Failed to archive session: ${(err as Error).message}`);
      }
    } else if (tooltip === 'Unarchive Session') {
      try {
        const session = await sdk.session.get(sessionID);
        const newTime = { ...session.time, archived: 0 };
        await sdk.session.update(sessionID, { time: newTime });

        void window.showInformationMessage('Session unarchived successfully.');
        await loadSessions();
      } catch (err) {
        void window.showErrorMessage(`Failed to unarchive session: ${(err as Error).message}`);
      }
    } else if (tooltip === 'Delete Session') {
      // Require confirmation for destructive action. Open/running requires distinct wording
      const message =
        isOpen || isRunning
          ? `The session is currently ${isRunning ? 'running' : 'open'}. Deleting it will permanently remove all history. Are you sure you want to delete it?`
          : 'Are you sure you want to permanently delete this session?';
      const confirm = await confirmAction(message, 'Confirm Delete');
      if (!confirm) {
        return;
      }

      try {
        await sdk.session.delete(sessionID);
        sessionStatuses.delete(sessionID);
        pendingBuffer.removeBySession(sessionID);
        relationTracker.clean(sessionID);

        const previousActiveID = sessionManager.activeSessionID;
        await sessionManager.close(sessionID);
        ipc.send({ type: 'session:deleted', sessionID });

        // If the deleted session was the active one, switch focus to another or fallback
        if (previousActiveID === sessionID) {
          await ensureActiveSessionFallback({
            sessionManager,
            sessionStateStore,
            cachedModels,
            cachedAgents,
            ipc,
            syncPendingRequests,
            sessionStatuses,
          });
        }
        await loadSessions();
      } catch (err) {
        void window.showErrorMessage(`Failed to delete session: ${(err as Error).message}`);
      }
    }
  });

  // Handle batch operation title bar buttons
  quickPick.onDidTriggerButton(async (button) => {
    if (button === deleteEmptyButton) {
      const confirm = await confirmAction(
        'Are you sure you want to delete all empty sessions (except currently open sessions)?',
        'Confirm Delete Empty Sessions',
      );
      if (!confirm) return;

      try {
        quickPick.placeholder = 'Deleting empty sessions...';
        const sessions = await sdk.session.list();
        const openIDs = sessionManager.getOpenSessionIDs();

        const emptySessionsResults = await Promise.all(
          sessions
            .filter((s) => !openIDs.includes(s.id))
            .map(async (s) => {
              try {
                const msgs = await sdk.session.messages(s.id);
                return msgs.length === 0 ? s : null;
              } catch {
                return s; // Treat retrieval failures as empty to clean them up safely
              }
            }),
        );
        const emptySessions = emptySessionsResults.filter((s): s is Session => s !== null);

        if (emptySessions.length === 0) {
          void window.showInformationMessage('No empty sessions found.');
          await loadSessions();
          return;
        }

        await Promise.all(
          emptySessions.map(async (s) => {
            await sdk.session.delete(s.id);
            sessionStatuses.delete(s.id);
            pendingBuffer.removeBySession(s.id);
            relationTracker.clean(s.id);
            await sessionManager.close(s.id);
            ipc.send({ type: 'session:deleted', sessionID: s.id });
          }),
        );

        void window.showInformationMessage(`Deleted ${emptySessions.length} empty sessions.`);
        await loadSessions();
      } catch (err) {
        void window.showErrorMessage(`Failed to delete empty sessions: ${(err as Error).message}`);
        await loadSessions();
      }
    } else if (button === archiveOldButton) {
      const confirm = await confirmAction(
        'Are you sure you want to archive all sessions older than 30 days?',
        'Confirm Archive Old Sessions',
      );
      if (!confirm) return;

      try {
        quickPick.placeholder = 'Archiving old sessions...';
        const sessions = await sdk.session.list();
        const thirtyDaysAgo = Date.now() - THIRTY_DAYS_MS;

        const oldSessions = sessions.filter((s) => {
          const isArchived = !!s.time.archived;
          const timeVal = s.time?.updated || s.time?.created || 0;
          return !isArchived && timeVal < thirtyDaysAgo;
        });

        if (oldSessions.length === 0) {
          void window.showInformationMessage('No sessions older than 30 days found.');
          await loadSessions();
          return;
        }

        const oldSessionIDs = oldSessions.map((s) => s.id);

        // Update backend sessions in parallel
        await Promise.all(
          oldSessions.map(async (s) => {
            await sdk.session.update(s.id, {
              time: { ...s.time, archived: Date.now() },
            });
          }),
        );

        // Update local sessionManager workspace states atomically to avoid race conditions
        const openIDs = sessionManager.getOpenSessionIDs();
        const updatedOpenIDs = openIDs.filter((id) => !oldSessionIDs.includes(id));
        await sessionManager.setOpenSessionIDs(updatedOpenIDs);

        const activeID = sessionManager.activeSessionID;
        const wasActiveArchived = activeID && oldSessionIDs.includes(activeID);
        if (wasActiveArchived) {
          const nextActiveID =
            updatedOpenIDs.length > 0 ? updatedOpenIDs[updatedOpenIDs.length - 1] : null;
          await sessionManager.setActiveSessionID(nextActiveID);
        }

        // Clean up remaining extension states for archived sessions
        for (const id of oldSessionIDs) {
          sessionStateStore.delete(id);
          sessionStatuses.delete(id);
          pendingBuffer.removeBySession(id);
          relationTracker.clean(id);
          ipc.send({ type: 'session:archived', sessionID: id });
        }

        // Handle active session switch if the current active session was archived
        if (wasActiveArchived) {
          await ensureActiveSessionFallback({
            sessionManager,
            sessionStateStore,
            cachedModels,
            cachedAgents,
            ipc,
            syncPendingRequests,
            sessionStatuses,
          });
        }

        void window.showInformationMessage(`Archived ${oldSessions.length} sessions.`);
        await loadSessions();
      } catch (err) {
        void window.showErrorMessage(`Failed to archive old sessions: ${(err as Error).message}`);
        await loadSessions();
      }
    } else if (
      button.tooltip?.startsWith('Show Archived') ||
      button.tooltip?.startsWith('Hide Archived')
    ) {
      showArchived = !showArchived;
      updateTitleButtons();
      await loadSessions();
    } else if (button === cleanArchivedButton) {
      const confirm = await confirmAction(
        'Are you sure you want to permanently delete all archived sessions?',
        'Confirm Purge Archived Sessions',
      );
      if (!confirm) return;

      try {
        quickPick.placeholder = 'Purging archived sessions...';
        const sessions = await sdk.session.list();
        const archivedSessions = sessions.filter((s) => !!s.time.archived);

        if (archivedSessions.length === 0) {
          void window.showInformationMessage('No archived sessions found to delete.');
          await loadSessions();
          return;
        }

        await Promise.all(
          archivedSessions.map(async (s) => {
            await sdk.session.delete(s.id);
            sessionStatuses.delete(s.id);
            pendingBuffer.removeBySession(s.id);
            relationTracker.clean(s.id);
            await sessionManager.close(s.id);
            ipc.send({ type: 'session:deleted', sessionID: s.id });
          }),
        );

        void window.showInformationMessage(
          `Deleted all ${archivedSessions.length} archived sessions.`,
        );
        await loadSessions();
      } catch (err) {
        void window.showErrorMessage(
          `Failed to purge archived sessions: ${(err as Error).message}`,
        );
        await loadSessions();
      }
    }
  });

  quickPick.onDidHide(() => {
    quickPick.dispose();
  });
}
