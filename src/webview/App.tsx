/**
 * @file Root React component for the OpenCode side panel webview.
 * Manages IPC message routing, session state, and renders the complete UI.
 */

import type { Part } from '@opencode-ai/sdk/v2/client';
import { useEffect, useState } from 'react';
import type { AgentInfo, ExtToWebview, ModelInfo } from '../shared/types';
import { ChatView } from './components/ChatView';
import { Codicon } from './components/Codicon';
import { PermissionBar } from './components/PermissionBar';
import { PromptInput } from './components/PromptInput';
import { QuestionBar } from './components/QuestionBar';
import { SessionTabs } from './components/SessionTabs';
import { SettingsPanel } from './components/SettingsPanel';
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

/** Main application component — orchestrates IPC, session state, and child components. */
export function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [activeModel, setActiveModel] = useState<string>('');
  const [activeAgent, setActiveAgent] = useState<string>('');
  const [modelVariants, setModelVariants] = useState<Record<string, string>>({});

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
          break;
        case 'session:switched':
          setActiveSession(message.sessionID);
          setActiveModel(message.model ?? '');
          setActiveAgent(message.agent ?? '');
          setModelVariants(message.modelVariants ?? {});
          break;
        case 'session:archived':
          removeSession(message.sessionID);
          break;
        case 'session:updated':
          updateSession(message.session);
          break;
        case 'session:deleted':
          removeSession(message.sessionID);
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
        case 'settings:open':
          setShowSettings(true);
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
        case 'init':
          setSessions(message.sessions);
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

  const currentStatus = activeSessionID ? sessionStatus[activeSessionID] : undefined;
  const activeQuestions = activeSessionID
    ? pendingQuestions.filter((q) => q.sessionID === activeSessionID)
    : [];
  const hasPendingQuestion = activeQuestions.length > 0;
  const activeQuestionRequestID = activeQuestions[0]?.id;

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
            sessionID={activeSessionID}
            messages={messages[activeSessionID] || []}
            parts={parts}
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
        />
      )}

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      <Tooltip />
    </div>
  );
}
