/**
 * @file PromptInputHeader component rendering the LSP, MCP, Skills, and extension version status bar.
 * Positioned above the input field to prevent clutter on narrow viewports.
 * Also displays a Redo button when a revert is active.
 */

import React from 'react';
import type { LspServerInfo, McpServerInfo, SkillInfo } from '../../shared/types';
import { useIPC } from '../hooks/useIPC';
import { useSessionStore } from '../store/sessionStore';
import { escapeHtml } from '../utils/chipUtils';
import { createReviewID } from '../utils/review-utils';
import { Codicon } from './Codicon';
import { DiffButton } from './DiffButton';

/** Props interface for PromptInputHeader component to allow independent rendering/testing. */
export interface PromptInputHeaderProps {
  /** Optional list of active LSP servers. Falls back to session store. */
  lspServers?: LspServerInfo[];
  /** Optional list of MCP servers. Falls back to session store. */
  mcpServers?: McpServerInfo[];
  /** Optional list of discovered skills. Falls back to session store. */
  skills?: SkillInfo[];
  /** Optional extension version string. Falls back to session store. */
  extensionVersion?: string;
  /** Callback when the user clicks the Redo button. */
  onRedo?: () => void;
}

/**
 * PromptInputHeader component that displays the status of active Language Servers (LSP),
 * Model Context Protocol (MCP) servers, discovered custom Skills, and current extension version.
 * Renders tooltip details on hover for deeper context.
 */
export function PromptInputHeader({
  lspServers: customLspServers,
  mcpServers: customMcpServers,
  skills: customSkills,
  extensionVersion: customExtensionVersion,
  onRedo,
}: PromptInputHeaderProps = {}) {
  // Retrieve session state details directly from Zustand store
  const storeLspServers = useSessionStore((s) => s.lspServers);
  const storeMcpServers = useSessionStore((s) => s.mcpServers);
  const storeSkills = useSessionStore((s) => s.skills);
  const storeExtensionVersion = useSessionStore((s) => s.extensionVersion);
  const activeSessionID = useSessionStore((s) => s.activeSessionID);
  const sessions = useSessionStore((s) => s.sessions);
  const sessionDiffs = useSessionStore((s) => s.sessionDiffs);
  const { send } = useIPC(() => {});

  const lspServers = customLspServers ?? storeLspServers;
  const mcpServers = customMcpServers ?? storeMcpServers;
  const skills = customSkills ?? storeSkills;
  const extensionVersion = customExtensionVersion ?? storeExtensionVersion;

  const activeSession = activeSessionID
    ? (sessions ?? []).find((s) => s.id === activeSessionID)
    : undefined;
  const hasRevert = !!activeSession?.revert?.messageID;
  const activeDiffs = activeSessionID ? (sessionDiffs[activeSessionID] ?? []) : [];

  // Compile rich HTML tooltips for hover displays.
  // Memoization ensures we don't rebuild HTML strings unnecessarily on every render.
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
              <td><span style="color: ${lsp.status === 'running' ? 'var(--vscode-charts-green)' : 'var(--vscode-charts-orange)'}">${escapeHtml(lsp.status)}</span></td>
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
                <span style="color: ${mcp.status === 'connected' || mcp.status === 'running' ? 'var(--vscode-charts-green)' : 'var(--vscode-charts-red)'}">
                  ${escapeHtml(mcp.status)}
                </span>
                ${mcp.error ? `<br/><span style="font-size:10px;color:var(--vscode-charts-red)">${escapeHtml(mcp.error)}</span>` : ''}
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

  return (
    <div className="prompt-input-header">
      <div className="metadata-item lsp" data-custom-title={lspTooltip} data-testid="header-lsp">
        <Codicon name="combine" className="metadata-icon" />
        <span>
          <span className="metadata-label">LSP: </span>
          {lspServers.length}
        </span>
      </div>

      <div className="metadata-item mcp" data-custom-title={mcpTooltip} data-testid="header-mcp">
        <Codicon name="plug" className="metadata-icon" />
        <span>
          <span className="metadata-label">MCP: </span>
          {mcpServers.length}
        </span>
      </div>

      <div
        className="metadata-item skills"
        data-custom-title={skillsTooltip}
        data-testid="header-skills"
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
        data-testid="header-version"
      >
        <Codicon name="info" className="metadata-icon" />
        <span>
          <span className="metadata-label">v</span>
          {extensionVersion}
        </span>
      </div>

      {activeDiffs.length > 0 && activeSessionID && (
        <DiffButton
          diffs={activeDiffs}
          className="metadata-item"
          onClick={() =>
            send({
              type: 'review:request',
              sessionID: activeSessionID,
              reviewID: createReviewID(activeSessionID, 'session'),
              diffs: activeDiffs,
              scope: 'session',
            })
          }
        />
      )}

      {hasRevert && onRedo && (
        <div
          className="metadata-item redo"
          onClick={onRedo}
          data-custom-title="Redo — restore reverted messages"
          data-testid="header-redo"
        >
          <Codicon name="redo" className="metadata-icon" />
          <span>
            <span className="metadata-label">Redo</span>
          </span>
        </div>
      )}
    </div>
  );
}
