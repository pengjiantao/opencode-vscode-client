/**
 * @file PromptInputFooter component rendering active workspace metadata, LSP/MCP status, and context/cost metrics.
 * Extracted from PromptInput to maintain readability and comply with file length constraints.
 */

import type { AssistantMessage, Message } from '@opencode-ai/sdk/v2/client';
import React from 'react';
import type { ModelInfo } from '../../shared/types';
import { useSessionStore } from '../store/sessionStore';
import { escapeHtml } from '../utils/chipUtils';
import { Codicon } from './Codicon';

/** Props interface for PromptInputFooter component */
export interface PromptInputFooterProps {
  /** List of available models to resolve context limit metadata. */
  models: ModelInfo[];
  /** Currently selected active model ID. */
  activeModel: string;
}

/**
 * Renders the bottom metadata footer displaying active workspace folder, LSP/MCP metrics, and tokens/cost usage.
 */
export function PromptInputFooter({ models, activeModel }: PromptInputFooterProps) {
  // Retrieve session state details directly from zustand store
  const workspaceName = useSessionStore((s) => s.workspaceName);
  const lspServers = useSessionStore((s) => s.lspServers);
  const mcpServers = useSessionStore((s) => s.mcpServers);
  const skills = useSessionStore((s) => s.skills);
  const plugins = useSessionStore((s) => s.plugins);
  const extensionVersion = useSessionStore((s) => s.extensionVersion);
  const activeSessionID = useSessionStore((s) => s.activeSessionID);
  const messages = useSessionStore((s) => s.messages);

  const sessionMessages = React.useMemo(() => {
    return messages[activeSessionID || ''] || [];
  }, [messages, activeSessionID]);

  const isAssistantMessage = (msg: Message): msg is AssistantMessage => {
    return msg.role === 'assistant';
  };

  // Computes the total tokens consumed by a message
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

  // Retrieve the last assistant message to extract active usage statistics
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

  // Resolve final model context limit
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

  // Compile rich HTML tooltips for hover displays
  const workspaceTooltip = React.useMemo(() => {
    return `
      <strong>Workspace Info</strong><br/>
      <table>
        <tr><td>Name:</td><td>${escapeHtml(workspaceName || 'No open folder')}</td></tr>
        <tr><td>Session:</td><td>${escapeHtml(activeSessionID || 'None')}</td></tr>
        ${plugins.length > 0 ? `<tr><td>Plugins:</td><td>${plugins.map(escapeHtml).join(', ')}</td></tr>` : ''}
      </table>
    `;
  }, [workspaceName, activeSessionID, plugins]);

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
  }, [lspServers]);

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
  }, [mcpServers]);

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
  }, [skills]);

  const versionTooltip = React.useMemo(() => {
    return `
      <strong>OpenCode Extension</strong><br/>
      <table>
        <tr><td>Version:</td><td>v${escapeHtml(extensionVersion)}</td></tr>
        <tr><td>Publisher:</td><td>Google DeepMind</td></tr>
        <tr><td>Core SDK:</td><td>@opencode-ai/sdk</td></tr>
      </table>
    `;
  }, [extensionVersion]);

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

  return (
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

        <div className="metadata-item lsp" data-custom-title={lspTooltip} data-testid="footer-lsp">
          <Codicon name="combine" className="metadata-icon" />
          <span>
            <span className="metadata-label">LSP: </span>
            {lspServers.length}
          </span>
        </div>

        <div className="metadata-item mcp" data-custom-title={mcpTooltip} data-testid="footer-mcp">
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
                  {contextTotalTokens.toLocaleString()} / {(finalLimit || 0).toLocaleString()}{' '}
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
  );
}
