/**
 * @file Renders a single user→assistant message turn.
 * Displays user message content and, if available, the assistant's response parts and action footer.
 */

import type { Message, Part } from '@opencode-ai/sdk';
import { useEffect, useState } from 'react';
import { Codicon } from './Codicon';
import { PartRenderer } from './PartRenderer';

interface MessageTurnProps {
  userMessage: Message;
  assistantMessage?: Message;
  parts: Record<string, Part[]>;
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

  const copyAnswer = () => {
    if (!assistantMessage) return;
    const assistantParts = parts[assistantMessage.id] || [];
    const answerText = assistantParts
      .filter((part) => part.type === 'text')
      .map((part) => (part as { text: string }).text)
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

  const showActions = assistantMessage && !isGenerating;

  return (
    <div className="message-turn">
      <div className="user-message">
        <div className="message-content">
          {parts[userMessage.id]?.map((part) => <PartRenderer key={part.id} part={part} />) || (
            <p>{getMessageText(userMessage)}</p>
          )}
        </div>
      </div>

      {assistantMessage && (
        <div className="assistant-message">
          <div className="message-content">
            {parts[assistantMessage.id]?.map((part) => (
              <PartRenderer key={part.id} part={part} isAssistant={true} />
            )) || <span className="streaming">Thinking...</span>}
          </div>

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
              <button
                className="action-btn"
                onClick={scrollToTop}
                data-custom-title="Scroll to top"
              >
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
      )}
    </div>
  );
}
