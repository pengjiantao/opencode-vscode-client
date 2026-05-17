/**
 * @file Root React component for the OpenCode side panel webview.
 * Manages IPC message routing, session state, and renders the complete UI.
 */

import type { Event, Message, Part, Permission, Session, SessionStatus } from '@opencode-ai/sdk';
import { useCallback, useEffect, useState } from 'react';
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
  const addMessage = useSessionStore((s) => s.addMessage);
  const updatePart = useSessionStore((s) => s.updatePart);
  const updatePartDelta = useSessionStore((s) => s.updatePartDelta);
  const setSessionStatus = useSessionStore((s) => s.setSessionStatus);
  const setPendingPermission = useSessionStore((s) => s.setPendingPermission);
  const setSessionMessagesAndParts = useSessionStore((s) => s.setSessionMessagesAndParts);

  const { send } = useIPC(() => {});
  useEvents();
  useKeyboardShortcuts();

  /** Dispatches SSE server events to the appropriate store actions. */
  const handleServerEvent = useCallback(
    (event: Event) => {
      const props = event.properties as {
        sessionID?: string;
        info?: Session | Message | Part | SessionStatus;
        part?: Part;
        permission?: Permission;
      };

      switch (event.type as string) {
        case 'session.created':
          addSession((props as { info: Session }).info);
          break;
        case 'session.updated':
          updateSession((props as { info: Session }).info);
          break;
        case 'session.deleted':
          removeSession((props as { info: Session }).info.id);
          break;
        case 'message.updated':
          addMessage(
            (props as { info: Message }).info.sessionID,
            (props as { info: Message }).info,
          );
          break;
        case 'message.part.updated':
          updatePart((props as { part: Part }).part);
          break;
        /** Appends streaming delta to an existing part's field. */
        case 'message.part.delta': {
          const deltaProps = (
            event as unknown as {
              properties: {
                messageID: string;
                partID: string;
                field: string;
                delta: string;
              };
            }
          ).properties;
          updatePartDelta(
            deltaProps.messageID,
            deltaProps.partID,
            deltaProps.field,
            deltaProps.delta,
          );
          break;
        }
        case 'session.status':
          setSessionStatus(
            (props as { sessionID: string }).sessionID,
            (props as { status: SessionStatus }).status,
          );
          break;
        case 'permission.updated':
          setPendingPermission((props as { permission: Permission }).permission);
          break;
      }
    },
    [
      addSession,
      updateSession,
      removeSession,
      addMessage,
      updatePart,
      updatePartDelta,
      setSessionStatus,
      setPendingPermission,
    ],
  );

  useEffect(() => {
    const handler = (event: MessageEvent<ExtToWebview>) => {
      const message = event.data;

      switch (message.type) {
        case 'session:created':
          addSession(message.session as Session);
          break;
        case 'session:switched':
          setActiveSession(message.sessionID);
          break;
        case 'session:archived':
          removeSession(message.sessionID);
          break;
        case 'session:updated':
          updateSession(message.session as Session);
          break;
        case 'session:deleted':
          removeSession(message.sessionID);
          break;
        case 'event:received':
          handleServerEvent(message.event);
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
        case 'error':
          console.error('Server error:', message.message);
          break;
        case 'init':
          setSessions(message.sessions as Session[]);
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
    handleServerEvent,
    setSessionMessagesAndParts,
    setSessions,
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

  const handleSubmitPrompt = (text: string) => {
    console.log(
      '[Webview] handleSubmitPrompt called with text:',
      text,
      'activeSessionID:',
      activeSessionID,
    );
    if (!activeSessionID) {
      console.warn('[Webview] handleSubmitPrompt aborted because activeSessionID is null');
      return;
    }
    console.log('[Webview] posting prompt:send to extension host');
    send({ type: 'prompt:send', text } as never);
  };

  const handleModelChange = (model: string) => {
    send({ type: 'model:switch', model } as never);
  };

  const handleAgentChange = (agent: string) => {
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
        onModelChange={handleModelChange}
        onAgentChange={handleAgentChange}
        disabled={!activeSessionID}
      />

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      <Tooltip />
    </div>
  );
}
