/**
 * @file Main chat message list component.
 * Groups messages into user/assistant turns and renders permission prompts.
 */

import type { Message, Part } from '@opencode-ai/sdk';
import { useMemo } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { MessageTurn } from './MessageTurn';
import { PermissionCard } from './PermissionCard';

interface ChatViewProps {
  sessionID: string;
  messages: Message[];
  parts: Record<string, Part[]>;
  onPermissionReply: (id: string, allow: boolean) => void;
}

/** Renders a list of user/assistant message turns with inline permission cards. */
export function ChatView({ sessionID, messages, parts, onPermissionReply }: ChatViewProps) {
  const pendingPermission = useSessionStore((s) => s.pendingPermission);
  const setPendingPermission = useSessionStore((s) => s.setPendingPermission);
  const sessionStatus = useSessionStore((s) => s.sessionStatus);

  const activeSessionStatus = sessionID ? sessionStatus[sessionID] : undefined;

  /** Groups sequential messages into user→assistant turn pairs. */
  const turns = useMemo(() => {
    const result: Array<{ user: Message; assistant?: Message }> = [];
    let currentUser: Message | null = null;

    for (const msg of messages) {
      if (msg.role === 'user') {
        // Flush previous pending user message
        if (currentUser) {
          result.push({ user: currentUser });
        }
        currentUser = msg;
      } else if (msg.role === 'assistant' && currentUser) {
        result.push({ user: currentUser, assistant: msg });
        currentUser = null;
      }
    }

    // Trailing user message with no response yet
    if (currentUser) {
      result.push({ user: currentUser });
    }

    return result;
  }, [messages]);

  const handlePermissionReply = (permissionID: string, allow: boolean) => {
    onPermissionReply(permissionID, allow);
    setPendingPermission(null);
  };

  return (
    <div className="chat-view">
      {pendingPermission && (
        <PermissionCard
          id={pendingPermission.id}
          type={pendingPermission.type}
          title={pendingPermission.title}
          metadata={pendingPermission.metadata}
          onReply={handlePermissionReply}
        />
      )}

      {turns.map((turn, index) => {
        const isLastTurn = index === turns.length - 1;
        const isGenerating =
          isLastTurn &&
          (activeSessionStatus?.type === 'busy' || activeSessionStatus?.type === 'retry');
        return (
          <MessageTurn
            key={turn.user.id}
            userMessage={turn.user}
            assistantMessage={turn.assistant}
            parts={parts}
            isGenerating={isGenerating}
          />
        );
      })}

      {turns.length === 0 && (
        <div className="empty-chat">
          <p>Start a conversation by typing a message below.</p>
        </div>
      )}
    </div>
  );
}
