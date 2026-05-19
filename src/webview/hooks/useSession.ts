/**
 * @file Convenience hook that bundles session store state with IPC actions.
 * Provides a single interface for session CRUD, prompt submission, and event handling.
 */

import type {
  Event,
  Message,
  Part,
  PermissionRequest,
  Session,
  SessionStatus,
} from '@opencode-ai/sdk/v2/client';
import { useCallback } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useIPC } from './useIPC';

/** Aggregates session state and actions from the store and IPC layer. */
export function useSession() {
  const { send } = useIPC(() => {});

  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionID = useSessionStore((s) => s.activeSessionID);
  const messages = useSessionStore((s) => s.messages);
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

  const createSession = useCallback(() => {
    send({ type: 'session:create' });
  }, [send]);

  const switchSession = useCallback(
    (sessionID: string) => {
      send({ type: 'session:switch', sessionID });
    },
    [send],
  );

  const closeSession = useCallback(
    (sessionID: string) => {
      send({ type: 'session:close', sessionID });
    },
    [send],
  );

  const closeAllSessions = useCallback(() => {
    send({ type: 'session:close-all' });
  }, [send]);

  const sendPrompt = useCallback(
    (text: string) => {
      send({ type: 'prompt:send', text });
    },
    [send],
  );

  const switchModel = useCallback(
    (model: string) => {
      send({ type: 'model:switch', model });
    },
    [send],
  );

  const switchAgent = useCallback(
    (agent: string) => {
      send({ type: 'agent:switch', agent });
    },
    [send],
  );

  const replyPermission = useCallback(
    (permissionID: string, allow: boolean) => {
      send({ type: 'permission:reply', permissionID, allow });
    },
    [send],
  );

  /** Dispatches SSE server events to the appropriate store mutations. */
  const handleEvent = useCallback(
    (event: Event) => {
      const props = event.properties as {
        sessionID?: string;
        info?: Session | Message | Part | SessionStatus;
        part?: Part;
        permission?: PermissionRequest;
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
        /** Appends streaming delta to a part field (e.g., incremental text). */
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
          setPendingPermission((props as { permission: PermissionRequest }).permission);
          break;
        default:
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

  return {
    sessions,
    activeSessionID,
    messages,
    sessionStatus,
    setActiveSession,
    setSessions,
    createSession,
    switchSession,
    closeSession,
    closeAllSessions,
    sendPrompt,
    switchModel,
    switchAgent,
    replyPermission,
    handleEvent,
  };
}
