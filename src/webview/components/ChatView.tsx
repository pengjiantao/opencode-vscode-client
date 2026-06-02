/**
 * @file Main chat message list component.
 * Groups messages into user/assistant turns and renders permission prompts.
 */

import type { Message, Part } from '@opencode-ai/sdk/v2/client';
import { forwardRef, memo, useCallback, useImperativeHandle, useMemo, useState } from 'react';
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

/** Handle exposed by ChatView for imperative actions. */
export interface ChatViewHandle {
  /** Forces the chat view to scroll to the bottom and re-enable auto-scroll. */
  triggerScrollToBottom: () => void;
}

interface ChatViewProps {
  sessionID: string;
  messages: Message[];
  parts: Record<string, Part[]>;
  /** Callback when the user confirms reverting a message. Restores it to the input box. */
  onRevert?: (messageID: string) => void;
  /** Callback when the user confirms forking at a specific message. */
  onFork?: (messageID: string) => void;
}

/** Renders a list of user/assistant message turns with inline permission cards.
 *  Wrapped in React.memo so App-level state changes (model selector, agent
 *  selector, etc.) do not re-trigger the message grouping walk. The shallow
 *  comparison relies on the caller passing stable references for `messages`,
 *  `parts`, and the revert/fork callbacks. */
export const ChatView = memo(
  forwardRef<ChatViewHandle, ChatViewProps>(function ChatView(
    { sessionID, messages, parts, onRevert, onFork }: ChatViewProps,
    ref,
  ) {
    const sessionStatus = useSessionStore((s) => s.sessionStatus);
    const sessions = useSessionStore((s) => s.sessions);

    const activeSessionStatus = sessionID ? sessionStatus[sessionID] : undefined;
    const activeSession = sessions.find((s) => s.id === sessionID);
    const revertMessageID = activeSession?.revert?.messageID;

    /** Counter that triggers forced scroll to bottom when incremented. */
    const [scrollTrigger, setScrollTrigger] = useState(0);

    /** Forces the chat view to scroll to the bottom and re-enable auto-scroll.
     *  Used for user-initiated actions like sending a message. */
    const triggerScrollToBottom = useCallback(() => {
      setScrollTrigger((prev) => prev + 1);
    }, []);

    // Expose triggerScrollToBottom to parent via ref
    useImperativeHandle(
      ref,
      () => ({
        triggerScrollToBottom,
      }),
      [triggerScrollToBottom],
    );

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
        scrollTrigger={scrollTrigger}
      >
        {turns.map((turn, index) => {
          const isLastTurn = index === turns.length - 1;
          const isGenerating =
            isLastTurn &&
            (activeSessionStatus?.type === 'busy' || activeSessionStatus?.type === 'retry');
          const isSessionBusy =
            activeSessionStatus?.type === 'busy' || activeSessionStatus?.type === 'retry';
          // Use array index (not string comparison) to determine reverted turns
          const revertIdx = revertMessageID
            ? turns.findIndex((t) => t.user.id === revertMessageID)
            : -1;
          const isReverted = revertIdx >= 0 && index >= revertIdx;
          return (
            <MessageTurn
              key={turn.user.id}
              userMessage={turn.user}
              assistantMessages={turn.assistantMessages}
              parts={parts}
              isGenerating={isGenerating}
              isLastTurn={isLastTurn}
              isSessionBusy={isSessionBusy}
              isReverted={isReverted}
              onRevert={onRevert}
              onFork={onFork}
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
  }),
);
