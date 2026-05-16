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

export function ChatView({ messages, parts, onPermissionReply }: ChatViewProps) {
  const pendingPermission = useSessionStore((s) => s.pendingPermission);
  const setPendingPermission = useSessionStore((s) => s.setPendingPermission);

  const turns = useMemo(() => {
    const result: Array<{ user: Message; assistant?: Message }> = [];
    let currentUser: Message | null = null;

    for (const msg of messages) {
      if (msg.role === 'user') {
        if (currentUser) {
          result.push({ user: currentUser });
        }
        currentUser = msg;
      } else if (msg.role === 'assistant' && currentUser) {
        result.push({ user: currentUser, assistant: msg });
        currentUser = null;
      }
    }

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

      {turns.map((turn) => (
        <MessageTurn
          key={turn.user.id}
          userMessage={turn.user}
          assistantMessage={turn.assistant}
          parts={parts}
        />
      ))}

      {turns.length === 0 && (
        <div className="empty-chat">
          <p>Start a conversation by typing a message below.</p>
        </div>
      )}
    </div>
  );
}
