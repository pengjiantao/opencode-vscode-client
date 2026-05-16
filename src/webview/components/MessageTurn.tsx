import type { Message, Part } from '@opencode-ai/sdk';
import { PartRenderer } from './PartRenderer';

interface MessageTurnProps {
  userMessage: Message;
  assistantMessage?: Message;
  parts: Record<string, Part[]>;
  status?: { type: string };
}

export function MessageTurn({ userMessage, assistantMessage, parts, status }: MessageTurnProps) {
  return (
    <div className="message-turn">
      <div className="user-message">
        <div className="message-header">
          <span className="role">You</span>
          <span className="time">{new Date(userMessage.time.created).toLocaleTimeString()}</span>
        </div>
        <div className="message-content">
          <p>{JSON.stringify(userMessage)}</p>
        </div>
      </div>

      {assistantMessage && (
        <div className="assistant-message">
          <div className="message-header">
            <span className="role">Assistant</span>
            <span className="time">
              {new Date(assistantMessage.time.created).toLocaleTimeString()}
            </span>
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
