/**
 * @file PromptInputFooter component rendering active workspace metadata and context/cost metrics.
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
 * Renders the bottom metadata footer displaying the active workspace folder, and token/cost metrics.
 */
export function PromptInputFooter({ models, activeModel }: PromptInputFooterProps) {
  // Retrieve session state details directly from zustand store
  const workspaceName = useSessionStore((s) => s.workspaceName);
  const plugins = useSessionStore((s) => s.plugins);
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

  // Retrieve the last assistant message to extract active usage statistics.
  // We filter out messages without output tokens (e.g. initial states or
  // incomplete steps) to align with TUI behavior.
  const lastAssistantMsg = React.useMemo(() => {
    for (let i = sessionMessages.length - 1; i >= 0; i--) {
      const msg = sessionMessages[i];
      if (!isAssistantMessage(msg) || !msg.tokens || !(msg.tokens.output > 0)) continue;
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

  const contextDisplay = React.useMemo(() => {
    if (contextTotalTokens > 0) {
      return (
        <>
          <span className="context-tokens-full">
            {contextTotalTokens.toLocaleString()} / {(finalLimit || 0).toLocaleString()}{' '}
          </span>
          <span>({contextPercentage}%)</span>
        </>
      );
    }
    return (
      <>
        <span className="context-tokens-full">0 / {(finalLimit || 0).toLocaleString()} </span>
        <span>(0%)</span>
      </>
    );
  }, [contextTotalTokens, finalLimit, contextPercentage]);

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
      </div>

      <div className="sub-footer-right">
        <div
          className={`metadata-item percentage ${contextPercentage > 80 ? 'warning' : ''}`}
          data-custom-title={metricsTooltip}
          data-testid="footer-context"
        >
          <Codicon name="graph" className="metadata-icon" />
          <span>{contextDisplay}</span>
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
