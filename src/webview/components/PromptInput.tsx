import {
  VSCodeButton,
  VSCodeDropdown,
  VSCodeOption,
  VSCodeTextArea,
} from '@vscode/webview-ui-toolkit/react';
import React from 'react';

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
      <div className="selectors">
        <VSCodeDropdown
          aria-label="Select model"
          onChange={(e) => onModelChange((e.target as HTMLSelectElement).value)}
        >
          {models.map((m) => (
            <VSCodeOption key={m.id} value={m.id}>
              {m.name}
            </VSCodeOption>
          ))}
        </VSCodeDropdown>

        <VSCodeDropdown
          aria-label="Select agent"
          onChange={(e) => onAgentChange((e.target as HTMLSelectElement).value)}
        >
          {agents.map((a) => (
            <VSCodeOption key={a.id} value={a.id}>
              {a.name}
            </VSCodeOption>
          ))}
        </VSCodeDropdown>
      </div>

      <VSCodeTextArea
        value={text}
        onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message... (Shift+Enter for new line)"
        disabled={disabled}
      />

      <VSCodeButton onClick={handleSubmit} disabled={disabled || !text.trim()}>
        Send
      </VSCodeButton>
    </div>
  );
}
