/**
 * @file VS Code extension activation entry point.
 * Initializes SDK client, session manager, IPC bridge, and webview provider.
 * Registers all IPC message handlers for session lifecycle and prompt operations.
 */

import type { Part, Session, SessionStatus } from '@opencode-ai/sdk/v2/client';
import { window, workspace, type ExtensionContext } from 'vscode';
import type { PromptHistoryEntry } from '../shared/types';
import { pasteClipboardTextAsPlainText, registerExtensionCommands } from './commands';
import { registerEventHandlers } from './event-handlers';
import { handleSelectHistory } from './history-handlers';
import { IPCBridge } from './ipc';
import { syncMetadata as importSyncMetadata } from './metadata';
import { PendingRequestBuffer } from './pending-request-buffer';
import { PromptHistoryStore } from './prompt-history-store';
import { ReviewPanelManager } from './review-panel-manager';
import type { SDKClient } from './sdk-client';
import { createSDKClient } from './sdk-client-impl';
import {
  handleCreateSession,
  handleForkSession,
  registerSessionLifecycleHandlers,
} from './session-handlers';
import { SessionManager } from './session-manager';
import { SessionRelationTracker } from './session-relation-tracker';
import { registerSessionStateHandlers } from './session-state-ipc-handlers';
import { SessionStateStore } from './session-state-store';
import { StatusBarManager } from './status-bar';
import type { AgentInfo, ModelInfo } from './types';
import { handleCommandPart } from './utils/command-router';
import { getConfiguration } from './utils/config';
import { registerFileHandlers } from './utils/fileHandlers';
import { deriveReasonFromError, resolveOpencodeBinary } from './utils/opencode-path';
import { showOpencodeNotFoundPrompt } from './utils/opencode-prompt';
import { OpencodeSidebarViewProvider } from './webview-provider';

let sdk: SDKClient;
let sessionManager: SessionManager;
let ipc: IPCBridge;
let provider: OpencodeSidebarViewProvider;
let promptHistoryStore: PromptHistoryStore;

/**
 * Activates the OpenCode sidebar extension.
 * Sets up SDK connection, IPC bridges, and registers handlers for lifecycle events.
 *
 * @param context VS Code ExtensionContext.
 */
export async function activate(context: ExtensionContext): Promise<void> {
  const sessionStateStore = new SessionStateStore(context.globalState);
  promptHistoryStore = new PromptHistoryStore(context.globalState);
  const sessionStatuses = new Map<string, SessionStatus>();
  const pendingBuffer = new PendingRequestBuffer();
  let cachedModels: ModelInfo[] = [];
  let cachedAgents: AgentInfo[] = [];

  // Track parent-child session relationships and titles for sub-agents
  const relationTracker = new SessionRelationTracker();

  // Track which sessions have had their diffs fetched to avoid redundant requests
  const fetchedDiffSessions = new Set<string>();

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
      sessionStateStore,
      cachedModels,
      cachedAgents,
      ipc,
      syncPendingRequests,
    });
  };

  /** Closes all open sessions and initializes a fallback new session. */
  const invokeCloseAllSessions = async (): Promise<void> => {
    sessionStatuses.clear();
    pendingBuffer.clear();
    relationTracker.clear();
    await sessionManager.closeAll();
    ipc.send({ type: 'init', sessions: [] });
    await invokeCreateSession();
  };

  /** Calls the extracted handleSelectHistory command handler. */
  const invokeSelectHistory = async (): Promise<void> => {
    await handleSelectHistory({
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
    });
  };

  /** Forks the active session after idle check. Sends fork:confirm IPC to webview for confirmation. */
  const invokeForkSession = (): void => {
    const activeID = sessionManager.activeSessionID;
    if (!activeID) {
      void window.showInformationMessage('No active session to fork.');
      return;
    }
    const status = sessionStatuses.get(activeID);
    if (status && (status.type === 'busy' || status.type === 'retry')) {
      void window.showWarningMessage('Cannot fork while session is processing.');
      return;
    }
    ipc.send({ type: 'fork:confirm', sessionID: activeID });
  };

  // Pre-flight: resolve the opencode binary path from configuration or PATH
  // BEFORE we attempt to spawn a server. This lets us surface a friendly
  // recovery prompt (opencode.executablePath / install docs / reload) instead
  // of failing activation with a raw `spawn opencode ENOENT` error.
  const extensionConfig = getConfiguration();
  const resolvedBinary = resolveOpencodeBinary(extensionConfig.executablePath);
  if (resolvedBinary.source === 'none') {
    await showOpencodeNotFoundPrompt(resolvedBinary);
    return;
  }

  try {
    const workspaceRoot = workspace.workspaceFolders?.[0]?.uri.fsPath;
    sdk = createSDKClient({
      directory: workspaceRoot,
      timeout: extensionConfig.serverTimeout,
      opencodeBinaryPath: resolvedBinary.path,
    });
    sessionManager = new SessionManager(sdk, context.workspaceState);
    ipc = new IPCBridge();
    provider = new OpencodeSidebarViewProvider(context, ipc);

    const reviewManager = new ReviewPanelManager(context, sdk);
    reviewManager.setMainIpc(ipc);
    context.subscriptions.push({ dispose: () => reviewManager.disposeAll() });

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

    // Seed the in-memory status map from the backend before the webview mounts so that
    // an extension restart (which wipes the Map) does not lose the running state of
    // any sessions that were already busy. Subsequent SSE `session.status` events keep
    // the map up to date.
    try {
      const initialStatuses = await sdk.session.statusAll();
      for (const [sessionID, status] of Object.entries(initialStatuses)) {
        sessionStatuses.set(sessionID, status);
      }
    } catch (err) {
      console.error('Failed to seed session statuses from backend:', err);
    }

    context.subscriptions.push(
      window.registerWebviewViewProvider('opencode-sidebar.main', provider),
    );

    /** Handles webview initialization: loads sessions, messages, models, and agents. */
    ipc.on('init', async () => {
      // Mark the IPC bridge as ready and flush any buffered selection messages
      // that were queued while the webview was reloading after being hidden.
      ipc.markReady();

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
        const activeSessions = sessions.filter((s) => !s.time.archived && !s.parentID);

        // Build the session parent-child relations and title mappings on startup.
        relationTracker.clear();
        for (const s of sessions) {
          relationTracker.titleMap.set(s.id, s.title);
          if (s.parentID) {
            relationTracker.parentMap.set(s.id, s.parentID);
          }
        }

        let openIDs = sessionManager.getOpenSessionIDs();
        // Remove stale session IDs that no longer exist on the server (including child sessions)
        openIDs = openIDs.filter((id) => sessions.some((s) => s.id === id && !s.time.archived));

        // Load activeSessionID from sessionManager's unified persistence
        let activeID = sessionManager.activeSessionID;
        // If the persisted active session no longer exists on the server (e.g.
        // stale workspace state from a prior install, or session was deleted),
        // reset it to null so the auto-create path below can trigger. Without
        // this, a stale ID would skip auto-creation and cause sessionManager
        // .switch() to throw, which is silently caught and leaves the webview
        // without any session.
        if (activeID && !openIDs.includes(activeID)) {
          activeID = null;
        }
        // Fall back to first open session or most recent active session
        if (!activeID) {
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

        // Synchronize open IDs back to sessionManager's persistence
        await sessionManager.setOpenSessionIDs(openIDs);

        // No active session found — auto-create one
        if (!activeID) {
          const session = await sessionManager.create();

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
          ipc.send({
            type: 'messages:list',
            sessionID: session.id,
            messages: [],
            parts: [],
            status: sessionStatuses.get(session.id),
          });
          syncPendingRequests(session.id);
        } else {
          await sessionManager.switch(activeID);

          // Migrate legacy configuration into the active session.
          sessionStateStore.migrateLegacyState(activeID);

          const openSessions = openIDs
            .map((id) => sessions.find((s) => s.id === id))
            .filter((s): s is Session => s !== undefined);
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

          // Fetch diff only for the active session to reduce init latency.
          // Other sessions' diffs are fetched lazily on switch (see session:switch handler).
          const diffsMap: Record<
            string,
            Array<{
              file?: string;
              additions: number;
              deletions: number;
              status?: string;
              patch?: string;
            }>
          > = {};
          try {
            const diffs = await sdk.session.diff(activeID);
            if (diffs.length > 0) diffsMap[activeID] = diffs;
          } catch {
            /* ignore */
          }
          fetchedDiffSessions.add(activeID);
          if (Object.keys(diffsMap).length > 0) {
            ipc.send({ type: 'session:diffs', diffs: diffsMap });
          }

          const { messages, parts } = await sessionManager.getMessagesAndParts(activeID);
          ipc.send({
            type: 'messages:list',
            sessionID: activeID,
            messages,
            parts,
            status: sessionStatuses.get(activeID),
          });
          syncPendingRequests(activeID);
        }

        // Send a bulk snapshot of every known session's status so the webview can
        // immediately render running (busy/retry) indicators across all tabs without
        // waiting for the next per-session SSE event to arrive. Sent last so the
        // per-session `messages:list` for the active tab is in place first.
        ipc.send({ type: 'session:statuses-bulk', statuses: Object.fromEntries(sessionStatuses) });
      } catch (err) {
        console.error('Failed to load session list on init:', err);
      } finally {
        void syncMetadata();
      }
    });

    ipc.on('session:create', () => {
      void invokeCreateSession();
    });

    ipc.on('prompt-history:list', () => {
      ipc.send({ type: 'prompt-history:list', entries: promptHistoryStore.list() });
    });

    ipc.on('prompt-history:append', (msg) => {
      const { entry } = msg as { entry: PromptHistoryEntry };
      Promise.resolve(promptHistoryStore.append(entry)).catch((err: unknown) => {
        console.error('Failed to persist prompt history entry:', err);
      });
    });

    registerSessionLifecycleHandlers({
      sdk,
      ipc,
      sessionManager,
      sessionStateStore,
      getCachedModels: () => cachedModels,
      getCachedAgents: () => cachedAgents,
      syncMetadata,
      syncPendingRequests,
      sessionStatuses,
      pendingBuffer,
      relationTracker,
      invokeCloseAllSessions,
      fetchedDiffSessions,
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

      // Mirror the opencode TUI's "append on submit" policy. We persist the history
      // entry from the extension side (not the webview) so the source of truth lives
      // in the same Memento the rest of the extension's persistent state uses, and
      // the webview can stay focused on UI. We then notify the webview of the new
      // entry so its in-memory mirror is up to date — otherwise the just-submitted
      // prompt is not recallable via Up/Down until the webview is reloaded.
      if (text && text.trim().length > 0) {
        const entry: PromptHistoryEntry = {
          input: text.trim(),
          parts: promptParts,
          mode: 'normal',
        };
        Promise.resolve(promptHistoryStore.append(entry))
          .then((persisted) => {
            // Skip the IPC echo on a back-to-back duplicate — `append` returns
            // `false` because no write happened, so the persisted list is
            // unchanged and the webview mirror is already in sync.
            if (persisted) {
              ipc.send({ type: 'prompt-history:appended', entry });
            }
          })
          .catch((err: unknown) => {
            console.error('Failed to persist prompt history entry on submit:', err);
          });
      }

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

    registerFileHandlers(ipc, sdk);
    registerSessionStateHandlers({
      ipc,
      sessionManager,
      sessionStateStore,
      getCachedModels: () => cachedModels,
      getCachedAgents: () => cachedAgents,
      syncMetadata,
    });

    ipc.on('prompt:abort', (msg) => {
      const { sessionID } = msg as { sessionID: string };
      handlePromise(sessionManager.abort(sessionID), 'Abort failed');
    });

    ipc.on('session:revert', async (msg) => {
      const { sessionID, messageID } = msg as { sessionID: string; messageID: string };
      try {
        await sdk.session.revert(sessionID, messageID);
        // Send back updated messages so the webview store reflects the revert state
        const { messages, parts } = await sessionManager.getMessagesAndParts(sessionID);
        ipc.send({
          type: 'messages:list',
          sessionID,
          messages,
          parts,
          status: sessionStatuses.get(sessionID),
        });
      } catch (err) {
        ipc.send({ type: 'error', message: `Revert failed: ${(err as Error).message}` });
      }
    });

    ipc.on('session:unrevert', async (msg) => {
      const { sessionID } = msg as { sessionID: string };
      try {
        await sdk.session.unrevert(sessionID);
        // Send back updated messages so the webview store has the restored messages
        const { messages, parts } = await sessionManager.getMessagesAndParts(sessionID);
        ipc.send({
          type: 'messages:list',
          sessionID,
          messages,
          parts,
          status: sessionStatuses.get(sessionID),
        });
      } catch (err) {
        ipc.send({ type: 'error', message: `Unrevert failed: ${(err as Error).message}` });
      }
    });

    ipc.on('session:fork', (msg) => {
      const { sessionID, messageID } = msg as { sessionID: string; messageID?: string };
      void handleForkSession(
        {
          sdk,
          ipc,
          sessionManager,
          sessionStateStore,
          getCachedModels: () => cachedModels,
          getCachedAgents: () => cachedAgents,
          syncPendingRequests,
          sessionStatuses,
        },
        sessionID,
        messageID,
      );
    });

    ipc.on('review:request', (msg) => {
      const { sessionID, messageID, reviewID, diffs, scope } = msg as {
        sessionID: string;
        messageID?: string;
        reviewID: string;
        diffs?: import('@opencode-ai/sdk/v2/client').SnapshotFileDiff[];
        scope?: 'turn' | 'session';
      };
      void reviewManager.open(reviewID, sessionID, messageID, 'Review Changes', diffs, scope);
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
    const unsubscribeEvents = registerEventHandlers({
      sdk,
      ipc,
      pendingBuffer,
      sessionStatuses,
      statusBarManager,
      relationTracker,
      syncMetadata,
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
      () => void invokeCloseAllSessions(),
      () => invokeForkSession(),
      sdk,
    );
  } catch (err) {
    // Spawn-time failures from the opencode server binary are translated into
    // the same friendly recovery flow as the pre-flight check. Other errors
    // (programming bugs, network errors to an already-running server) still
    // surface as a generic activation-failed toast.
    const message = err instanceof Error ? err.message : String(err);
    const looksLikeBinaryProblem =
      /\b(ENOENT|EACCES|spawn opencode|executable)\b/i.test(message) ||
      /Timeout waiting for server to start/i.test(message);
    if (looksLikeBinaryProblem) {
      // The pre-flight check already established whether the binary is sourced
      // from the user's configured path or from PATH. Reuse that source so we
      // can derive an accurate {config-invalid, config-not-executable,
      // not-in-path} reason from the spawn error, rather than blindly
      // synthesising "not-in-path" (which would mislead the user when the real
      // cause is e.g. EACCES on a configured file). The configuredPath is
      // threaded through so config-* messages can quote the exact path the
      // user typed into settings.
      const source: 'config' | 'path' = resolvedBinary.source === 'config' ? 'config' : 'path';
      const configuredPath = resolvedBinary.source === 'config' ? resolvedBinary.path : undefined;
      const reason = deriveReasonFromError(err, source);
      const noneResult = {
        path: null,
        source: 'none' as const,
        reason,
        ...(configuredPath ? { configuredPath } : {}),
      };
      await showOpencodeNotFoundPrompt(noneResult, err);
    } else {
      window.showErrorMessage(`OpenCode Sidebar activation failed: ${message}`);
    }
  }
}
