/**
 * @file Convenience hook that bundles session store state with IPC actions.
 * Provides a single interface for session CRUD, prompt submission, and event handling.
 */

import type {
  Event,
  Message,
  Part,
  PermissionRequest,
  QuestionRequest,
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
  const updateMessage = useSessionStore((s) => s.updateMessage);
  const updatePart = useSessionStore((s) => s.updatePart);
  const updatePartDelta = useSessionStore((s) => s.updatePartDelta);
  const removeMessagesFrom = useSessionStore((s) => s.removeMessagesFrom);
  const removePart = useSessionStore((s) => s.removePart);
  const setSessionStatus = useSessionStore((s) => s.setSessionStatus);
  const addPendingPermission = useSessionStore((s) => s.addPendingPermission);
  const removePendingPermission = useSessionStore((s) => s.removePendingPermission);
  const addPendingQuestion = useSessionStore((s) => s.addPendingQuestion);
  const removePendingQuestion = useSessionStore((s) => s.removePendingQuestion);

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
    (permissionID: string, replyOrAllow: 'once' | 'always' | 'reject' | boolean) => {
      const reply =
        typeof replyOrAllow === 'boolean' ? (replyOrAllow ? 'once' : 'reject') : replyOrAllow;
      send({ type: 'permission:reply', permissionID, reply } as never);
    },
    [send],
  );

  const replyQuestion = useCallback(
    (requestID: string, answers: string[][]) => {
      send({ type: 'question:reply', requestID, answers } as never);
    },
    [send],
  );

  const rejectQuestion = useCallback(
    (requestID: string) => {
      send({ type: 'question:reject', requestID } as never);
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
        /** Removes a message and all subsequent messages from a session's store. */
        case 'message.removed': {
          const removedProps = (
            event as unknown as { properties: { sessionID: string; messageID: string } }
          ).properties;
          removeMessagesFrom(removedProps.sessionID, removedProps.messageID);
          break;
        }
        /** Removes a single part from a message's part list. */
        case 'message.part.removed': {
          const partRemovedProps = (
            event as unknown as { properties: { messageID: string; partID: string } }
          ).properties;
          removePart(partRemovedProps.messageID, partRemovedProps.partID);
          break;
        }
        case 'session.status':
          setSessionStatus(
            (props as { sessionID: string }).sessionID,
            (props as { status: SessionStatus }).status,
          );
          break;
        case 'permission.asked':
          addPendingPermission(props as unknown as PermissionRequest);
          break;
        case 'permission.replied':
          removePendingPermission((props as unknown as { requestID: string }).requestID);
          break;
        case 'question.asked':
          addPendingQuestion(props as unknown as QuestionRequest);
          break;
        case 'question.replied':
        case 'question.rejected':
          removePendingQuestion((props as unknown as { requestID: string }).requestID);
          break;
        case 'session.next.step.ended': {
          const stepProps = (
            event as unknown as {
              properties: {
                sessionID: string;
                tokens: {
                  input: number;
                  output: number;
                  reasoning: number;
                  cache: { read: number; write: number };
                };
                cost: number;
              };
            }
          ).properties;
          const { messages: storeMessages } = useSessionStore.getState();
          const sessionMessages = storeMessages[stepProps.sessionID] || [];

          // Find the last assistant message in the session and update it with the
          // finished step's tokens and cost so that statistics refresh in real-time.
          for (let i = sessionMessages.length - 1; i >= 0; i--) {
            const msg = sessionMessages[i];
            if (msg.role === 'assistant') {
              updateMessage({
                ...msg,
                tokens: stepProps.tokens,
                cost: stepProps.cost,
              });
              break;
            }
          }
          break;
        }
        default:
          break;
      }
    },
    [
      addSession,
      updateSession,
      removeSession,
      addMessage,
      updateMessage,
      updatePart,
      updatePartDelta,
      removeMessagesFrom,
      removePart,
      setSessionStatus,
      addPendingPermission,
      removePendingPermission,
      addPendingQuestion,
      removePendingQuestion,
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
    replyQuestion,
    rejectQuestion,
    handleEvent,
    addPendingPermission,
    removePendingPermission,
    addPendingQuestion,
    removePendingQuestion,
  };
}
