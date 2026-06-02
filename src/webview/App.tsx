/**
 * @file Root React component for the OpenCode side panel webview.
 * Manages IPC message routing, session state, and renders the complete UI.
 */

import type { Part, SnapshotFileDiff } from '@opencode-ai/sdk/v2/client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AgentInfo, ExtToWebview, ModelInfo } from '../shared/types';
import type { ChatViewHandle } from './components/ChatView';
import { ChatView } from './components/ChatView';
import { Codicon } from './components/Codicon';
import { ForkConfirmDialog } from './components/ForkConfirmDialog';
import { PermissionBar } from './components/PermissionBar';
import { PromptInput } from './components/PromptInput';
import { QuestionBar } from './components/QuestionBar';
import { SessionTabs } from './components/SessionTabs';
import { Tooltip } from './components/Tooltip';
import { useEvents } from './hooks/useEvents';
import { useIPC } from './hooks/useIPC';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useSessionStore } from './store/sessionStore';

declare global {
  interface Window {
    vscode: {
      postMessage: (message: unknown) => void;
      getState: () => unknown;
      setState: (state: unknown) => void;
    };
  }
}

/** Stable empty parts record. Reused across renders so the parts prop
 *  reference stays the same when the active session has no messages. */
const EMPTY_PARTS: Record<string, Part[]> = {};

/** Stable empty parts list for a single message. Reused across messages. */
const EMPTY_PARTS_FOR_MESSAGE: Part[] = [];

/** Main application component — orchestrates IPC, session state, and child components. */
export function App() {
  const chatViewRef = useRef<ChatViewHandle>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [activeModel, setActiveModel] = useState<string>('');
  const [activeAgent, setActiveAgent] = useState<string>('');
  const [modelVariants, setModelVariants] = useState<Record<string, string>>({});
  const [restoreParts, setRestoreParts] = useState<Part[]>([]);
  const [showForkConfirm, setShowForkConfirm] = useState(false);
  const [forkTargetSessionID, setForkTargetSessionID] = useState<string | null>(null);
  const [forkTargetMessageID, setForkTargetMessageID] = useState<string | undefined>(undefined);

  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionID = useSessionStore((s) => s.activeSessionID);
  const messages = useSessionStore((s) => s.messages);
  const parts = useSessionStore((s) => s.parts);
  const sessionStatus = useSessionStore((s) => s.sessionStatus);
  const pendingQuestions = useSessionStore((s) => s.pendingQuestions);

  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const setSessions = useSessionStore((s) => s.setSessions);
  const addSession = useSessionStore((s) => s.addSession);
  const removeSession = useSessionStore((s) => s.removeSession);
  const updateSession = useSessionStore((s) => s.updateSession);
  const setSessionMessagesAndParts = useSessionStore((s) => s.setSessionMessagesAndParts);
  const setPendingRequests = useSessionStore((s) => s.setPendingRequests);
  const setSessionDiffs = useSessionStore((s) => s.setSessionDiffs);
  const clearChildSessions = useSessionStore((s) => s.clearChildSessions);
  const mergeChildSessionData = useSessionStore((s) => s.mergeChildSessionData);

  const setWorkspaceName = useSessionStore((s) => s.setWorkspaceName);
  const setLspServers = useSessionStore((s) => s.setLspServers);
  const setMcpServers = useSessionStore((s) => s.setMcpServers);
  const setSkills = useSessionStore((s) => s.setSkills);
  const setCommands = useSessionStore((s) => s.setCommands);
  const setPlugins = useSessionStore((s) => s.setPlugins);
  const setExtensionVersion = useSessionStore((s) => s.setExtensionVersion);
  const setFileInfo = useSessionStore((s) => s.setFileInfo);

  const { send } = useIPC(() => {});
  useEvents();
  useKeyboardShortcuts();

  useEffect(() => {
    const handler = (event: MessageEvent<ExtToWebview>) => {
      const message = event.data;

      switch (message.type) {
        case 'session:created':
          addSession(message.session);
          if (message.session.summary?.diffs) {
            setSessionDiffs(message.session.id, message.session.summary.diffs);
          }
          break;
        case 'session:switched':
          setActiveSession(message.sessionID);
          clearChildSessions();
          setActiveModel(message.model ?? '');
          setActiveAgent(message.agent ?? '');
          setModelVariants(message.modelVariants ?? {});
          break;
        case 'session:archived':
          removeSession(message.sessionID);
          break;
        case 'session:updated':
          updateSession(message.session);
          if (message.session.summary?.diffs) {
            setSessionDiffs(message.session.id, message.session.summary.diffs);
          }
          break;
        case 'session:deleted':
          removeSession(message.sessionID);
          break;
        case 'session:diffs':
          if (message.diffs && typeof message.diffs === 'object') {
            for (const [sessionID, diffs] of Object.entries(message.diffs)) {
              if (Array.isArray(diffs) && diffs.every(isValidSnapshotFileDiff)) {
                setSessionDiffs(sessionID, diffs);
              } else {
                console.error(`Invalid diffs data received for session ${sessionID}`, diffs);
              }
            }
          }
          break;
        case 'models:list':
          setModels(message.models);
          break;
        case 'agents:list':
          setAgents(message.agents);
          break;
        case 'messages:list':
          setSessionMessagesAndParts(
            message.sessionID,
            message.messages,
            message.parts,
            message.status,
          );
          break;
        case 'messages:child-loaded':
          mergeChildSessionData(message.sessionID, message.messages, message.parts);
          break;
        case 'file:query-response':
          setFileInfo(message.path, {
            exists: message.exists,
            size: message.size,
            content: message.content,
            isWorkspace: message.isWorkspace,
          });
          break;
        case 'metadata:sync':
          setWorkspaceName(message.workspaceName);
          setLspServers(message.lspServers);
          setMcpServers(message.mcpServers);
          setSkills(message.skills);
          setCommands(message.commands || []);
          setPlugins(message.plugins);
          setExtensionVersion(message.extensionVersion);
          break;
        case 'error':
          console.error('Server error:', message.message);
          break;
        case 'fork:confirm':
          setForkTargetSessionID(message.sessionID);
          setForkTargetMessageID(undefined);
          setShowForkConfirm(true);
          break;
        case 'init':
          setSessions(message.sessions);
          for (const session of message.sessions) {
            if (session.summary?.diffs) {
              setSessionDiffs(session.id, session.summary.diffs);
            }
          }
          break;
        case 'pending-requests':
          setPendingRequests(message.sessionID, message.permissions, message.questions);
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [
    addSession,
    setActiveSession,
    removeSession,
    updateSession,
    setSessionMessagesAndParts,
    setSessions,
    setWorkspaceName,
    setLspServers,
    setMcpServers,
    setSkills,
    setCommands,
    setPlugins,
    setExtensionVersion,
    setFileInfo,
    setPendingRequests,
    setSessionDiffs,
    clearChildSessions,
    mergeChildSessionData,
  ]);

  const handleSwitchSession = (sessionID: string) => {
    send({ type: 'session:switch', sessionID } as never);
  };

  const handleCloseSession = (sessionID: string) => {
    send({ type: 'session:close', sessionID } as never);
  };

  const handleSubmitPrompt = (text: string, parts?: Part[]) => {
    console.log(
      '[Webview] handleSubmitPrompt called with text:',
      text,
      'parts:',
      parts,
      'activeSessionID:',
      activeSessionID,
    );
    if (!activeSessionID) {
      console.warn('[Webview] handleSubmitPrompt aborted because activeSessionID is null');
      return;
    }
    // Force scroll to bottom when user sends a message
    chatViewRef.current?.triggerScrollToBottom();
    console.log('[Webview] posting prompt:send to extension host');
    send({ type: 'prompt:send', text, parts } as never);
  };

  const handleModelChange = (model: string) => {
    setActiveModel(model);
    send({ type: 'model:switch', sessionID: activeSessionID ?? undefined, model } as never);
  };

  const handleAgentChange = (agent: string) => {
    setActiveAgent(agent);
    send({ type: 'agent:switch', sessionID: activeSessionID ?? undefined, agent } as never);
  };

  const handleVariantChange = (model: string, variant: string) => {
    setModelVariants((prev) => ({ ...prev, [model]: variant }));
    send({
      type: 'variant:switch',
      sessionID: activeSessionID ?? undefined,
      model,
      variant,
    } as never);
  };

  const handlePermissionReply = (permissionID: string, reply: 'once' | 'always' | 'reject') => {
    send({ type: 'permission:reply', permissionID, reply } as never);
  };

  const handleQuestionReply = (requestID: string, answers: string[][]) => {
    send({ type: 'question:reply', requestID, answers } as never);
  };

  const handleQuestionReject = (requestID: string) => {
    send({ type: 'question:reject', requestID } as never);
  };

  /** Handles revert: sends IPC and restores user message parts to the input box. */
  const handleRevert = useCallback(
    (messageID: string) => {
      if (!activeSessionID) return;
      // Collect user message parts for restoring to input box
      const sessionMessages = messages[activeSessionID] || [];
      const userMsg = sessionMessages.find((m) => m.id === messageID);
      if (userMsg) {
        const userParts = (parts[messageID] || []).filter(
          (p) => !(p as { synthetic?: boolean }).synthetic,
        );
        // Set restore parts (triggers useEffect in PromptInput to populate editor)
        setRestoreParts([...userParts]);
      }
      // Send revert IPC to extension host.
      // The host will send back the updated messages:list after the operation.
      send({ type: 'session:revert', sessionID: activeSessionID, messageID } as never);
    },
    [activeSessionID, messages, parts, send],
  );

  /** Handles redo: finds next user message forward or fully restores. */
  const handleRedo = () => {
    if (!activeSessionID) return;
    const activeSession = sessions.find((s) => s.id === activeSessionID);
    const revertMessageID = activeSession?.revert?.messageID;
    if (!revertMessageID) return;

    const sessionMessages = messages[activeSessionID] || [];
    // Use array index (not string comparison) to find the next user message
    const revertIdx = sessionMessages.findIndex((m) => m.id === revertMessageID);
    const nextUserMsg =
      revertIdx >= 0
        ? sessionMessages.slice(revertIdx + 1).find((m) => m.role === 'user')
        : undefined;
    if (nextUserMsg) {
      // Partial redo: revert to the next user message forward
      send({
        type: 'session:revert',
        sessionID: activeSessionID,
        messageID: nextUserMsg.id,
      } as never);
    } else {
      // Full redo: restore everything
      send({ type: 'session:unrevert', sessionID: activeSessionID } as never);
    }
  };

  /** Opens fork confirmation dialog at a specific message, restoring its content to the input box.
   *  The confirmation already happened in MessageTurn's ForkConfirmDialog, so directly send IPC. */
  const handleForkAtMessage = useCallback(
    (messageID: string) => {
      if (!activeSessionID) return;
      const userParts = (parts[messageID] || []).filter(
        (p) => !(p as { synthetic?: boolean }).synthetic,
      );
      setRestoreParts([...userParts]);
      send({
        type: 'session:fork',
        sessionID: activeSessionID,
        messageID,
      } as never);
    },
    [activeSessionID, parts, send],
  );

  /** Confirms the fork operation and sends IPC to the extension host. */
  const handleForkConfirm = () => {
    if (!forkTargetSessionID) return;
    send({
      type: 'session:fork',
      sessionID: forkTargetSessionID,
      messageID: forkTargetMessageID,
    } as never);
    setShowForkConfirm(false);
    setForkTargetSessionID(null);
    setForkTargetMessageID(undefined);
  };

  /** Cancels the fork dialog and resets fork state. */
  const handleForkCancel = () => {
    setShowForkConfirm(false);
    setForkTargetSessionID(null);
    setForkTargetMessageID(undefined);
  };

  const currentStatus = activeSessionID ? sessionStatus[activeSessionID] : undefined;
  const activeQuestions = activeSessionID
    ? pendingQuestions.filter((q) => q.sessionID === activeSessionID)
    : [];
  const hasPendingQuestion = activeQuestions.length > 0;
  const activeQuestionRequestID = activeQuestions[0]?.id;

  // Slice the parts record down to just the active session's messages. This
  // gives the memoized ChatView a stable parts reference as long as the
  // relevant parts haven't changed, even when other sessions' parts update.
  const activeSessionParts = useMemo(() => {
    if (!activeSessionID) return EMPTY_PARTS;
    const sessionMessages = messages[activeSessionID];
    if (!sessionMessages) return EMPTY_PARTS;
    const sliced: Record<string, Part[]> = {};
    for (const msg of sessionMessages) {
      sliced[msg.id] = parts[msg.id] || EMPTY_PARTS_FOR_MESSAGE;
    }
    return sliced;
  }, [activeSessionID, messages, parts]);

  return (
    <div className="app">
      <SessionTabs
        sessions={sessions}
        activeSessionID={activeSessionID}
        onSwitch={handleSwitchSession}
        onClose={handleCloseSession}
      />

      {activeSessionID ? (
        <>
          <ChatView
            ref={chatViewRef}
            sessionID={activeSessionID}
            messages={messages[activeSessionID] || []}
            parts={activeSessionParts}
            onRevert={handleRevert}
            onFork={handleForkAtMessage}
          />
          {hasPendingQuestion ? (
            <QuestionBar
              key={activeQuestionRequestID || ''}
              sessionID={activeSessionID}
              onReply={handleQuestionReply}
              onReject={handleQuestionReject}
            />
          ) : (
            <PermissionBar sessionID={activeSessionID} onReply={handlePermissionReply} />
          )}
        </>
      ) : (
        <div className="no-session">
          <Codicon name="comment-discussion" className="no-session-icon" />
          <p className="no-session-text">No active session. Create a new session to start.</p>
        </div>
      )}

      {!hasPendingQuestion && (
        <PromptInput
          onSubmit={handleSubmitPrompt}
          onAbort={() => {
            if (activeSessionID) {
              send({ type: 'prompt:abort', sessionID: activeSessionID } as never);
            }
          }}
          status={currentStatus}
          models={models}
          agents={agents}
          activeModel={activeModel}
          activeAgent={activeAgent}
          modelVariants={modelVariants}
          onModelChange={handleModelChange}
          onAgentChange={handleAgentChange}
          onVariantChange={handleVariantChange}
          disabled={!activeSessionID}
          restoreParts={restoreParts}
          onRedo={handleRedo}
          onRestoreComplete={() => setRestoreParts([])}
        />
      )}

      <ForkConfirmDialog
        visible={showForkConfirm}
        mode={forkTargetMessageID ? 'message' : 'session'}
        onConfirm={handleForkConfirm}
        onCancel={handleForkCancel}
      />

      <Tooltip />
    </div>
  );
}

/**
 * Type guard to validate that a value conforms to the SnapshotFileDiff structure.
 * Checks for required numeric properties and optional string properties.
 *
 * @param item The value to validate.
 * @returns True if the value is a valid SnapshotFileDiff.
 */
function isValidSnapshotFileDiff(item: unknown): item is SnapshotFileDiff {
  if (!item || typeof item !== 'object') {
    return false;
  }
  const diffItem = item as Record<string, unknown>;
  return (
    typeof diffItem.additions === 'number' &&
    typeof diffItem.deletions === 'number' &&
    (diffItem.file === undefined || typeof diffItem.file === 'string') &&
    (diffItem.status === undefined || typeof diffItem.status === 'string') &&
    (diffItem.patch === undefined || typeof diffItem.patch === 'string')
  );
}
