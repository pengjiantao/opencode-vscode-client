/**
 * @file Main chat message list component.
 * Groups messages into user/assistant turns and renders permission prompts.
 */

import type { Message, Part } from '@opencode-ai/sdk/v2/client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { MessageTurn } from './MessageTurn';
import { PermissionCard } from './PermissionCard';

/**
 * Checks whether a user message is entirely backend-generated (all parts are synthetic).
 * Such messages (e.g. "Summarize the task output and continue") should not split turns.
 */
function isSyntheticUserMessage(messageID: string, parts: Record<string, Part[]>): boolean {
  const msgParts = parts[messageID];
  if (!msgParts || msgParts.length === 0) return false;
  return msgParts.every((p) => !!(p as { synthetic?: boolean }).synthetic);
}

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

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);

  /** Groups sequential messages into user→assistant turn pairs.
   *  Backend-generated synthetic user messages (all parts synthetic) are skipped
   *  to keep subagent and main-agent responses in a single continuous turn. */
  const turns = useMemo(() => {
    const result: Array<{ user: Message; assistantMessages: Message[] }> = [];
    let currentTurn: { user: Message; assistantMessages: Message[] } | null = null;

    for (const msg of messages) {
      if (msg.role === 'user') {
        if (isSyntheticUserMessage(msg.id, parts)) {
          // Backend-generated continuation — don't start a new turn
          continue;
        }
        if (currentTurn) {
          result.push(currentTurn);
        }
        currentTurn = { user: msg, assistantMessages: [] };
      } else if (msg.role === 'assistant' && currentTurn) {
        currentTurn.assistantMessages.push(msg);
      }
    }

    if (currentTurn) {
      result.push(currentTurn);
    }

    return result;
  }, [messages, parts]);

  const handlePermissionReply = (permissionID: string, allow: boolean) => {
    onPermissionReply(permissionID, allow);
    setPendingPermission(null);
  };

  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;

    // A threshold to account for fractional pixels and subpixel rendering
    const threshold = 10;
    const isAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;

    setIsAutoScrollEnabled(isAtBottom);
  };

  useEffect(() => {
    if (isAutoScrollEnabled && scrollRef.current) {
      // Use requestAnimationFrame to ensure the scroll happens after DOM layout updates
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
  }, [turns, activeSessionStatus, isAutoScrollEnabled, parts, pendingPermission]);

  return (
    <div className="chat-view" ref={scrollRef} onScroll={handleScroll}>
      {pendingPermission && (
        <PermissionCard
          id={pendingPermission.id}
          type={pendingPermission.permission}
          title={pendingPermission.permission}
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
            assistantMessages={turn.assistantMessages}
            parts={parts}
            isGenerating={isGenerating}
            isLastTurn={isLastTurn}
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
