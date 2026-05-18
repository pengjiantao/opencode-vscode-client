/**
 * @file Chat input area with text area, model/agent selectors, and send/stop button.
 * Supports auto-resize textarea, Enter to send, and model/agent selection.
 */

import type { SessionStatus } from '@opencode-ai/sdk';
import React from 'react';
import { AgentSelector } from './AgentSelector';
import { IconButton } from './IconButton';
import { ModelSelector } from './ModelSelector';

interface PromptInputProps {
  onSubmit: (text: string) => void;
  onAbort?: () => void;
  status?: SessionStatus;
  models: Array<{ id: string; name: string }>;
  agents: Array<{ id: string; name: string }>;
  activeModel?: string;
  activeAgent?: string;
  onModelChange: (model: string) => void;
  onAgentChange: (agent: string) => void;
  disabled?: boolean;
}

/** Bottom input bar with textarea, model/agent dropdowns, and send/stop button. */
export function PromptInput({
  onSubmit,
  onAbort,
  status,
  models,
  agents,
  activeModel: controlledModel,
  activeAgent: controlledAgent,
  onModelChange,
  onAgentChange,
  disabled = false,
}: PromptInputProps) {
  const [text, setText] = React.useState('');
  const [isFocused, setIsFocused] = React.useState(false);

  // Hybrid controlled/uncontrolled pattern:
  // If controlled props (controlledModel / controlledAgent) are provided (e.g. from persisted App/globalState),
  // they are prioritized. Otherwise, we fallback to local component state (localModel / localAgent) for backwards
  // compatibility, component autonomy, and unit test isolation.
  const [localModel, setLocalModel] = React.useState('');
  const [localAgent, setLocalAgent] = React.useState('');

  const selectedModel = controlledModel !== undefined ? controlledModel : localModel;
  const selectedAgent = controlledAgent !== undefined ? controlledAgent : localAgent;

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const isRunning = status?.type === 'busy' || status?.type === 'retry';

  // Derive active model and agent (implicit first element when not selected yet)
  const activeModel = selectedModel || (models.length > 0 ? models[0].id : '');
  const activeAgent = selectedAgent || (agents.length > 0 ? agents[0].id : '');

  // Notify extension of first model/agent default once loaded
  React.useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      onModelChange(models[0].id);
    }
  }, [models, selectedModel, onModelChange]);

  React.useEffect(() => {
    if (agents.length > 0 && !selectedAgent) {
      onAgentChange(agents[0].id);
    }
  }, [agents, selectedAgent, onAgentChange]);

  // Dynamic textarea height adjustment up to 10 lines (200px)
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      // 200px max-height limit (10 lines * 20px)
      textarea.style.height = `${Math.min(scrollHeight, 200)}px`;
    }
  }, [text]);

  const handleSubmit = () => {
    if (isRunning) {
      onAbort?.();
    } else if (text.trim()) {
      onSubmit(text.trim());
      setText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="prompt-input">
      <div className={`prompt-input-container ${isFocused ? 'focused' : ''}`}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Type a message... (Shift+Enter for new line)"
          disabled={disabled}
        />

        <div className="prompt-input-footer">
          <div className="selectors">
            <ModelSelector
              models={models}
              value={activeModel}
              onChange={(m) => {
                setLocalModel(m);
                onModelChange(m);
              }}
            />

            <AgentSelector
              agents={agents}
              value={activeAgent}
              onChange={(a) => {
                setLocalAgent(a);
                onAgentChange(a);
              }}
            />
          </div>

          <span
            data-custom-title={isRunning ? 'Stop' : 'Send'}
            style={{
              display: 'inline-flex',
              cursor: disabled || (!isRunning && !text.trim()) ? 'not-allowed' : 'default',
            }}
          >
            <IconButton
              name={isRunning ? 'debug-stop' : 'send'}
              onClick={handleSubmit}
              disabled={disabled || (!isRunning && !text.trim())}
              title={isRunning ? 'Stop' : 'Send'}
              className={isRunning ? 'stop-btn' : 'send-btn'}
              size="medium"
              style={{
                pointerEvents: disabled || (!isRunning && !text.trim()) ? 'none' : 'auto',
              }}
            />
          </span>
        </div>
      </div>
    </div>
  );
}
