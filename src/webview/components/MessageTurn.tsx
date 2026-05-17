/**
 * @file Renders a single user→assistant message turn.
 * Displays user message content and, if available, the assistant's response parts.
 */

import type { Message, Part } from '@opencode-ai/sdk';
import { PartRenderer } from './PartRenderer';

interface MessageTurnProps {
  userMessage: Message;
  assistantMessage?: Message;
  parts: Record<string, Part[]>;
  status?: { type: string };
}

/** A paired user message and optional assistant response with part rendering. */
export function MessageTurn({ userMessage, assistantMessage, parts, status }: MessageTurnProps) {
  return (
    <div className="message-turn">
      <div className="user-message">
        <div className="message-header">
          <span className="role">You</span>
          <span className="time">{new Date(userMessage.time.created).toLocaleTimeString()}</span>
        </div>
        <div className="message-content">
          {parts[userMessage.id]?.map((part) => <PartRenderer key={part.id} part={part} />) || (
            <p>{(userMessage as unknown as { text?: string }).text || ''}</p>
          )}
        </div>
      </div>

      {assistantMessage && (
        <div className="assistant-message">
          <div className="message-header">
            <span className="role">Assistant</span>
            <span className="time">
              {new Date(assistantMessage.time.created).toLocaleTimeString()}
            </span>
            {/* Show status indicator (e.g., streaming) when not idle */}
            {status && status.type !== 'idle' && <span className="status">{status.type}</span>}
          </div>
          <div className="message-content">
            {parts[assistantMessage.id]?.map((part) => (
              <PartRenderer key={part.id} part={part} />
            )) || <span className="streaming">Thinking...</span>}
          </div>
        </div>
      )}
    </div>
  );
}
