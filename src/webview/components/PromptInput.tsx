import type { AssistantMessage, Message, SessionStatus } from '@opencode-ai/sdk/v2/client';
import React from 'react';
import { useSessionStore } from '../store/sessionStore';
import '../styles/footer.css';
import { AgentSelector } from './AgentSelector';
import { Codicon } from './Codicon';
import { IconButton } from './IconButton';
import { ModelSelector } from './ModelSelector';

interface PromptInputProps {
  onSubmit: (text: string) => void;
  onAbort?: () => void;
  status?: SessionStatus;
  models: Array<{
    id: string;
    name: string;
    providerId?: string;
    providerName?: string;
    isConnected?: boolean;
    contextLimit?: number;
  }>;
  agents: Array<{ id: string; name: string }>;
  activeModel?: string;
  activeAgent?: string;
  onModelChange: (model: string) => void;
  onAgentChange: (agent: string) => void;
  disabled?: boolean;
}

/** Bottom input bar with textarea, model/agent dropdowns, send/stop button, and status footer. */
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

  // Select live status metadata and message logs from Zustand store
  const workspaceName = useSessionStore((s) => s.workspaceName);
  const lspServers = useSessionStore((s) => s.lspServers);
  const mcpServers = useSessionStore((s) => s.mcpServers);
  const skills = useSessionStore((s) => s.skills);
  const plugins = useSessionStore((s) => s.plugins);
  const extensionVersion = useSessionStore((s) => s.extensionVersion);

  const activeSessionID = useSessionStore((s) => s.activeSessionID);
  const messages = useSessionStore((s) => s.messages);

  // Derive cumulative cost and active context window utilization metrics
  const sessionMessages = React.useMemo(() => {
    return messages[activeSessionID || ''] || [];
  }, [messages, activeSessionID]);

  const isAssistantMessage = (msg: Message): msg is AssistantMessage => {
    return msg.role === 'assistant';
  };

  const tokenTotal = React.useCallback((msg: Message) => {
    if (!isAssistantMessage(msg) || !msg.tokens) return 0;
    const t = msg.tokens;
    return (
      (t.input || 0) +
      (t.output || 0) +
      (t.reasoning || 0) +
      (t.cache?.read || 0) +
      (t.cache?.write || 0)
    );
  }, []);

  const lastAssistantMsg = React.useMemo(() => {
    for (let i = sessionMessages.length - 1; i >= 0; i--) {
      const msg = sessionMessages[i];
      if (!isAssistantMessage(msg)) continue;
      return msg;
    }
    return null;
  }, [sessionMessages]);

  const totalCost = React.useMemo(() => {
    return sessionMessages.reduce((sum, msg) => {
      return sum + (isAssistantMessage(msg) ? msg.cost || 0 : 0);
    }, 0);
  }, [sessionMessages]);

  const activeModelDetails = models.find((m) => m.id === activeModel);
  const activeLimit = activeModelDetails?.contextLimit;

  // Retrieve precise model-specific token context limit
  const finalLimit = React.useMemo(() => {
    if (lastAssistantMsg && isAssistantMessage(lastAssistantMsg)) {
      const msgModelId = `${lastAssistantMsg.providerID}/${lastAssistantMsg.modelID}`;
      const msgModelDetails = models.find((m) => m.id === msgModelId);
      if (msgModelDetails && msgModelDetails.contextLimit) {
        return msgModelDetails.contextLimit;
      }
    }
    return activeLimit;
  }, [lastAssistantMsg, activeLimit, models]);

  const contextTotalTokens = lastAssistantMsg ? tokenTotal(lastAssistantMsg) : 0;
  const contextPercentage =
    finalLimit && contextTotalTokens > 0 ? Math.round((contextTotalTokens / finalLimit) * 100) : 0;

  const escapeHtml = React.useCallback((str: string): string => {
    return str.replace(/[&<>"']/g, (m) => {
      switch (m) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        case "'":
          return '&#39;';
        default:
          return m;
      }
    });
  }, []);

  // Compile rich HTML tooltips for mouse hover displays
  const workspaceTooltip = React.useMemo(() => {
    return `
      <strong>Workspace Info</strong><br/>
      <table>
        <tr><td>Name:</td><td>${escapeHtml(workspaceName || 'No open folder')}</td></tr>
        <tr><td>Session:</td><td>${escapeHtml(activeSessionID || 'None')}</td></tr>
        ${plugins.length > 0 ? `<tr><td>Plugins:</td><td>${plugins.map(escapeHtml).join(', ')}</td></tr>` : ''}
      </table>
    `;
  }, [workspaceName, activeSessionID, plugins, escapeHtml]);

  const lspTooltip = React.useMemo(() => {
    return `
      <strong>Language Servers (LSP)</strong><br/>
      ${
        lspServers.length === 0
          ? 'No language servers active.'
          : `
        <table>
          ${lspServers
            .map(
              (lsp) => `
            <tr>
              <td>${escapeHtml(lsp.name)}:</td>
              <td><span style="color: ${lsp.status === 'running' ? '#89d185' : '#cca700'}">${escapeHtml(lsp.status)}</span></td>
            </tr>
          `,
            )
            .join('')}
        </table>
      `
      }
    `;
  }, [lspServers, escapeHtml]);

  const mcpTooltip = React.useMemo(() => {
    return `
      <strong>Model Context Protocol (MCP)</strong><br/>
      ${
        mcpServers.length === 0
          ? 'No MCP servers configured.'
          : `
        <table>
          ${mcpServers
            .map(
              (mcp) => `
            <tr>
              <td>${escapeHtml(mcp.name)}:</td>
              <td>
                <span style="color: ${mcp.status === 'connected' || mcp.status === 'running' ? '#89d185' : '#f48771'}">
                  ${escapeHtml(mcp.status)}
                </span>
                ${mcp.error ? `<br/><span style="font-size:10px;color:#f48771">${escapeHtml(mcp.error)}</span>` : ''}
              </td>
            </tr>
          `,
            )
            .join('')}
        </table>
      `
      }
    `;
  }, [mcpServers, escapeHtml]);

  const skillsTooltip = React.useMemo(() => {
    return `
      <strong>Discovered Skills</strong><br/>
      ${
        skills.length === 0
          ? 'No custom skills discovered.'
          : `
        <ul>
          ${skills
            .map(
              (s) => `
            <li>
              <strong>${escapeHtml(s.name)}</strong>
              ${s.description ? `<br/><span style="font-size: 11px; color: var(--vscode-descriptionForeground)">${escapeHtml(s.description)}</span>` : ''}
            </li>
          `,
            )
            .join('')}
        </ul>
      `
      }
    `;
  }, [skills, escapeHtml]);

  const versionTooltip = React.useMemo(() => {
    return `
      <strong>OpenCode Extension</strong><br/>
      <table>
        <tr><td>Version:</td><td>v${escapeHtml(extensionVersion)}</td></tr>
        <tr><td>Publisher:</td><td>Google DeepMind</td></tr>
        <tr><td>Core SDK:</td><td>@opencode-ai/sdk</td></tr>
      </table>
    `;
  }, [extensionVersion, escapeHtml]);

  const metricsTooltip = React.useMemo(() => {
    return `
      <strong>Context & Session Metrics</strong><br/>
      ${
        lastAssistantMsg
          ? `
        <table>
          <tr><td>Input Tokens:</td><td>${(lastAssistantMsg.tokens?.input || 0).toLocaleString()}</td></tr>
          <tr><td>Output Tokens:</td><td>${(lastAssistantMsg.tokens?.output || 0).toLocaleString()}</td></tr>
          <tr><td>Reasoning:</td><td>${(lastAssistantMsg.tokens?.reasoning || 0).toLocaleString()}</td></tr>
          <tr><td>Cache Read:</td><td>${(lastAssistantMsg.tokens?.cache?.read || 0).toLocaleString()}</td></tr>
          <tr><td>Cache Write:</td><td>${(lastAssistantMsg.tokens?.cache?.write || 0).toLocaleString()}</td></tr>
          <tr style="border-top: 1px solid var(--vscode-editor-widget-border)">
            <td><strong>Total Context:</strong></td>
            <td><strong>${contextTotalTokens.toLocaleString()}</strong></td>
          </tr>
          <tr><td>Model Limit:</td><td>${finalLimit ? finalLimit.toLocaleString() : 'N/A'}</td></tr>
          <tr><td>Window Usage:</td><td>${contextPercentage}%</td></tr>
          <tr style="border-top: 1px dashed var(--vscode-editor-widget-border)">
            <td><strong>Cumulative Cost:</strong></td>
            <td><strong style="color: var(--vscode-statusBarItem-warningForeground, #e2c08d)">$${totalCost.toFixed(4)}</strong></td>
          </tr>
        </table>
      `
          : `
        <p>No assistant interactions in this session yet.</p>
        <table>
          <tr><td>Model Limit:</td><td>${finalLimit ? finalLimit.toLocaleString() : 'N/A'}</td></tr>
          <tr><td>Cumulative Cost:</td><td><strong>$${totalCost.toFixed(4)}</strong></td></tr>
        </table>
      `
      }
    `;
  }, [lastAssistantMsg, finalLimit, contextTotalTokens, contextPercentage, totalCost]);

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

      <div className="prompt-input-sub-footer">
        <div className="sub-footer-left">
          <div
            className="metadata-item workspace"
            data-custom-title={workspaceTooltip}
            data-testid="footer-workspace"
          >
            <Codicon name="folder" className="metadata-icon" />
            <span>{workspaceName || 'No Workspace'}</span>
          </div>

          <div
            className="metadata-item lsp"
            data-custom-title={lspTooltip}
            data-testid="footer-lsp"
          >
            <Codicon name="combine" className="metadata-icon" />
            <span>
              <span className="metadata-label">LSP: </span>
              {lspServers.length}
            </span>
          </div>

          <div
            className="metadata-item mcp"
            data-custom-title={mcpTooltip}
            data-testid="footer-mcp"
          >
            <Codicon name="plug" className="metadata-icon" />
            <span>
              <span className="metadata-label">MCP: </span>
              {mcpServers.length}
            </span>
          </div>

          <div
            className="metadata-item skills"
            data-custom-title={skillsTooltip}
            data-testid="footer-skills"
          >
            <Codicon name="workspace-trusted" className="metadata-icon" />
            <span>
              <span className="metadata-label">Skills: </span>
              {skills.length}
            </span>
          </div>

          <div
            className="metadata-item version"
            data-custom-title={versionTooltip}
            data-testid="footer-version"
          >
            <Codicon name="info" className="metadata-icon" />
            <span>
              <span className="metadata-label">v</span>
              {extensionVersion}
            </span>
          </div>
        </div>

        <div className="sub-footer-right">
          <div
            className={`metadata-item percentage ${contextPercentage > 80 ? 'warning' : ''}`}
            data-custom-title={metricsTooltip}
            data-testid="footer-context"
          >
            <Codicon name="graph" className="metadata-icon" />
            <span>
              {contextTotalTokens > 0 ? (
                <>
                  <span className="context-tokens-full">
                    {contextTotalTokens.toLocaleString()} /{' '}
                    {(finalLimit || 0).toLocaleString()}{' '}
                  </span>
                  <span>({contextPercentage}%)</span>
                </>
              ) : (
                <>
                  <span className="context-tokens-full">
                    0 / {(finalLimit || 0).toLocaleString()}{' '}
                  </span>
                  <span>(0%)</span>
                </>
              )}
            </span>
          </div>

          <div
            className="metadata-item cost"
            data-custom-title={metricsTooltip}
            data-testid="footer-cost"
          >
            <Codicon name="credit-card" className="metadata-icon" />
            <span>${totalCost.toFixed(3)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
