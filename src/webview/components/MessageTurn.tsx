/**
 * @file Renders a single user→assistant message turn.
 * Displays user message content and, if available, the assistant's response parts and action footer.
 */

import type { Message, Part } from '@opencode-ai/sdk/v2/client';
import { useEffect, useState } from 'react';
import { Codicon } from './Codicon';
import { PartRenderer } from './PartRenderer';

interface MessageTurnProps {
  /** The user message initiated in this turn. */
  userMessage: Message;
  /** Single assistant response message (legacy / test support). */
  assistantMessage?: Message;
  /** One or more assistant messages generated as response steps. */
  assistantMessages?: Message[];
  /** Map of all parts keyed by message ID. */
  parts: Record<string, Part[]>;
  /** Whether the assistant is currently generating output. */
  isGenerating?: boolean;
}

/**
 * Safe type-guard helper to extract fallback text from a message.
 * Prevents unsafe castings and conforms with strict typing rules.
 */
function getMessageText(message: Message): string {
  if (
    message &&
    typeof message === 'object' &&
    'text' in message &&
    typeof (message as { text: unknown }).text === 'string'
  ) {
    return (message as { text: string }).text;
  }
  return '';
}

/** A paired user message and optional assistant response with part rendering. */
export function MessageTurn({
  userMessage,
  assistantMessage,
  assistantMessages,
  parts,
  isGenerating = false,
}: MessageTurnProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => {
        setCopied(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const messagesToRender = assistantMessages
    ? assistantMessages
    : assistantMessage
      ? [assistantMessage]
      : [];

  const copyAnswer = () => {
    if (messagesToRender.length === 0) return;
    const answerText = messagesToRender
      .flatMap((msg) => parts[msg.id] || [])
      .filter((part) => part.type === 'text')
      .map((part) => {
        if ('text' in part && typeof part.text === 'string') {
          return part.text;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
    void navigator.clipboard.writeText(answerText || '');
    setCopied(true);
  };

  const scrollToTop = () => {
    const chatView = document.querySelector('.chat-view');
    if (chatView) {
      chatView.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToRecentUser = () => {
    const userMsgs = document.querySelectorAll('.user-message');
    if (userMsgs.length > 0) {
      const lastUserMsg = userMsgs[userMsgs.length - 1];
      lastUserMsg.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const renderUserParts = () => {
    const userParts = parts[userMessage.id];
    if (!userParts) {
      return <p>{getMessageText(userMessage)}</p>;
    }

    const nonSyntheticParts = userParts.filter((p) => !(p as { synthetic?: boolean }).synthetic);

    const hasTextPart = nonSyntheticParts.some(
      (p) => p.type === 'text' && p.metadata?.type !== 'pasted-text',
    );
    if (!hasTextPart) {
      return nonSyntheticParts.map((part) => (
        <PartRenderer key={part.id} part={part} allParts={userParts} />
      ));
    }

    return nonSyntheticParts
      .filter((p) => p.type === 'text' && p.metadata?.type !== 'pasted-text')
      .map((part) => <PartRenderer key={part.id} part={part} allParts={userParts} />);
  };

  const showActions = messagesToRender.length > 0 && !isGenerating;

  return (
    <div className="message-turn">
      <div className="user-message">
        <div className="message-content">{renderUserParts()}</div>
      </div>

      {messagesToRender.map((msg) => (
        <div key={msg.id} className="assistant-message">
          <div className="message-content">
            {parts[msg.id]?.map((part) => (
              <PartRenderer key={part.id} part={part} isAssistant={true} />
            )) || <span className="streaming">Thinking...</span>}
          </div>
        </div>
      ))}

      {showActions && (
        <div className="message-actions">
          <button
            className="action-btn"
            onClick={copyAnswer}
            data-custom-title={copied ? 'Copied!' : 'Copy Answer'}
          >
            <Codicon name={copied ? '$(check)' : '$(copy)'} />
            <span>{copied ? 'Copied!' : 'Copy Answer'}</span>
          </button>
          <button className="action-btn" onClick={scrollToTop} data-custom-title="Scroll to top">
            <Codicon name="$(arrow-up)" />
            <span>To Top</span>
          </button>
          <button
            className="action-btn"
            onClick={scrollToRecentUser}
            data-custom-title="Scroll to recent user message"
          >
            <Codicon name="$(chevron-down)" />
            <span>To Recent User</span>
          </button>
        </div>
      )}
    </div>
  );
}
