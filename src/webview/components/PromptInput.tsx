import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import React from 'react';
import { AgentSelector } from './AgentSelector';
import { ModelSelector } from './ModelSelector';

interface PromptInputProps {
  onSubmit: (text: string) => void;
  models: Array<{ id: string; name: string }>;
  agents: Array<{ id: string; name: string }>;
  onModelChange: (model: string) => void;
  onAgentChange: (agent: string) => void;
  disabled?: boolean;
}

export function PromptInput({
  onSubmit,
  models,
  agents,
  onModelChange,
  onAgentChange,
  disabled = false,
}: PromptInputProps) {
  const [text, setText] = React.useState('');
  const [selectedModel, setSelectedModel] = React.useState('');
  const [selectedAgent, setSelectedAgent] = React.useState('');
  const [isFocused, setIsFocused] = React.useState(false);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

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
    if (text.trim()) {
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
                setSelectedModel(m);
                onModelChange(m);
              }}
            />

            <AgentSelector
              agents={agents}
              value={activeAgent}
              onChange={(a) => {
                setSelectedAgent(a);
                onAgentChange(a);
              }}
            />
          </div>

          <VSCodeButton onClick={handleSubmit} disabled={disabled || !text.trim()}>
            Send
          </VSCodeButton>
        </div>
      </div>
    </div>
  );
}
