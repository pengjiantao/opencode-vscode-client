/**
 * @file Root React component for the OpenCode side panel webview.
 * Manages IPC message routing, session state, and renders the complete UI.
 */

import type { Part } from '@opencode-ai/sdk/v2/client';
import { useEffect, useState } from 'react';
import type { ExtToWebview } from '../shared/types';
import { ChatView } from './components/ChatView';
import { PromptInput } from './components/PromptInput';
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
  const [models, setModels] = useState<
    Array<{
      id: string;
      name: string;
      providerId?: string;
      providerName?: string;
      isConnected?: boolean;
    }>
  >([]);
  const [agents, setAgents] = useState<
    Array<{ id: string; name: string; mode?: string; hidden?: boolean }>
  >([]);
  const [activeModel, setActiveModel] = useState<string>('');
  const [activeAgent, setActiveAgent] = useState<string>('');

  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionID = useSessionStore((s) => s.activeSessionID);
  const messages = useSessionStore((s) => s.messages);
  const parts = useSessionStore((s) => s.parts);
  const sessionStatus = useSessionStore((s) => s.sessionStatus);

  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const setSessions = useSessionStore((s) => s.setSessions);
  const addSession = useSessionStore((s) => s.addSession);
  const removeSession = useSessionStore((s) => s.removeSession);
  const updateSession = useSessionStore((s) => s.updateSession);
  const setSessionMessagesAndParts = useSessionStore((s) => s.setSessionMessagesAndParts);

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
          setSessionMessagesAndParts(message.sessionID, message.messages, message.parts);
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
          if (message.activeModel) {
            setActiveModel(message.activeModel);
          }
          if (message.activeAgent) {
            setActiveAgent(message.activeAgent);
          }
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
  ]);

  const handleCreateSession = () => {
    send({ type: 'session:create' } as never);
  };

  const handleSwitchSession = (sessionID: string) => {
    send({ type: 'session:switch', sessionID } as never);
  };

  const handleCloseSession = (sessionID: string) => {
    send({ type: 'session:close', sessionID } as never);
  };

  const handleCloseAllSessions = () => {
    send({ type: 'session:close-all' } as never);
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
    send({ type: 'model:switch', model } as never);
  };

  const handleAgentChange = (agent: string) => {
    setActiveAgent(agent);
    send({ type: 'agent:switch', agent } as never);
  };

  const handlePermissionReply = (permissionID: string, allow: boolean) => {
    send({ type: 'permission:reply', permissionID, allow } as never);
  };

  const currentStatus = activeSessionID ? sessionStatus[activeSessionID] : undefined;

  return (
    <div className="app">
      <SessionTabs
        sessions={sessions}
        activeSessionID={activeSessionID}
        onSwitch={handleSwitchSession}
        onClose={handleCloseSession}
        onCloseAll={handleCloseAllSessions}
      />

      {activeSessionID ? (
        <ChatView
          sessionID={activeSessionID}
          messages={messages[activeSessionID] || []}
          parts={parts}
          onPermissionReply={handlePermissionReply}
        />
      ) : (
        <div className="no-session">
          <p>No active session. Create a new session to start.</p>
          <button onClick={handleCreateSession}>New Session</button>
        </div>
      )}

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
        onModelChange={handleModelChange}
        onAgentChange={handleAgentChange}
        disabled={!activeSessionID}
      />

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      <Tooltip />
    </div>
  );
}
