/**
 * @file Main chat message list component.
 * Groups messages into user/assistant turns and renders permission prompts.
 */

import type { Message, Part } from '@opencode-ai/sdk/v2/client';
import { useMemo } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { Codicon } from './Codicon';
import { MessageTurn } from './MessageTurn';
import { ScrollFadeContainer } from './ScrollFadeContainer';

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
}

/** Renders a list of user/assistant message turns with inline permission cards. */
export function ChatView({ sessionID, messages, parts }: ChatViewProps) {
  const sessionStatus = useSessionStore((s) => s.sessionStatus);

  const activeSessionStatus = sessionID ? sessionStatus[sessionID] : undefined;

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

  return (
    <ScrollFadeContainer
      className="chat-view-container"
      contentClassName="chat-view"
      autoScroll={true}
      dependencies={[turns, activeSessionStatus, parts]}
    >
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
          <Codicon name="comment-discussion" className="empty-chat-icon" />
          <p className="empty-chat-text">Start a conversation by typing a message below.</p>
        </div>
      )}
    </ScrollFadeContainer>
  );
}
