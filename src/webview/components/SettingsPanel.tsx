import { VSCodeButton, VSCodeCheckbox, VSCodeTextField } from '@vscode/webview-ui-toolkit/react';
import { useState } from 'react';

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [defaultModel, setDefaultModel] = useState('');
  const [defaultAgent, setDefaultAgent] = useState('');
  const [autoSend, setAutoSend] = useState(false);
  const [syntaxHighlighting, setSyntaxHighlighting] = useState(true);

  const handleSave = () => {
    // TODO: Persist settings via IPC
    window.vscode.postMessage({
      type: 'settings:save',
      payload: {
        defaultModel,
        defaultAgent,
        autoSend,
        syntaxHighlighting,
      },
    });
    onClose();
  };

  const handleReset = () => {
    setDefaultModel('');
    setDefaultAgent('');
    setAutoSend(false);
    setSyntaxHighlighting(true);
  };

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>Settings</h2>
        <button className="close-button" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="settings-body">
        <div className="settings-section">
          <h3>Defaults</h3>
          <div className="settings-field">
            <label>Default Model</label>
            <VSCodeTextField
              value={defaultModel}
              onInput={(e) => setDefaultModel((e.target as HTMLInputElement).value)}
              placeholder="provider/model (e.g., anthropic/claude-3)"
            />
          </div>
          <div className="settings-field">
            <label>Default Agent</label>
            <VSCodeTextField
              value={defaultAgent}
              onInput={(e) => setDefaultAgent((e.target as HTMLInputElement).value)}
              placeholder="Agent name (e.g., build, plan)"
            />
          </div>
        </div>

        <div className="settings-section">
          <h3>Behavior</h3>
          <div className="settings-field">
            <VSCodeCheckbox
              checked={autoSend}
              onChange={(e) => setAutoSend((e.target as HTMLInputElement).checked)}
            />
            <label>Auto-send after submission</label>
          </div>
          <div className="settings-field">
            <VSCodeCheckbox
              checked={syntaxHighlighting}
              onChange={(e) => setSyntaxHighlighting((e.target as HTMLInputElement).checked)}
            />
            <label>Enable syntax highlighting in code blocks</label>
          </div>
        </div>

        <div className="settings-section">
          <h3>Keyboard Shortcuts</h3>
          <div className="shortcuts-list">
            <div className="shortcut-item">
              <kbd>Ctrl+Shift+L</kbd>
              <span>Create new session</span>
            </div>
            <div className="shortcut-item">
              <kbd>Escape</kbd>
              <span>Abort current operation</span>
            </div>
            <div className="shortcut-item">
              <kbd>Alt+1-9</kbd>
              <span>Switch to session tab</span>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-footer">
        <VSCodeButton onClick={handleReset}>Reset</VSCodeButton>
        <VSCodeButton onClick={handleSave}>Save</VSCodeButton>
      </div>
    </div>
  );
}
