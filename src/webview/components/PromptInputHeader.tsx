/**
 * @file PromptInputHeader component rendering the LSP, MCP, Skills, and extension version status bar.
 * Positioned above the input field to prevent clutter on narrow viewports.
 * Also displays a Redo button when a revert is active.
 */

import type { LspServerInfo, McpServerInfo, SkillInfo } from '../../shared/types';
import { useIPC } from '../hooks/useIPC';
import { useSessionStore } from '../store/sessionStore';
import { createReviewID } from '../utils/review-utils';
import { useTooltipContent } from '../utils/tooltipContentRegistry';
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
  /** Optional extension publisher id (e.g. 'fiyqkrc'). Falls back to session store. */
  publisher?: string;
  /** Optional opencode server version string. Falls back to session store. */
  opencodeVersion?: string;
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
  publisher: customPublisher,
  opencodeVersion: customOpencodeVersion,
  onRedo,
}: PromptInputHeaderProps = {}) {
  // Retrieve session state details directly from Zustand store
  const storeLspServers = useSessionStore((s) => s.lspServers);
  const storeMcpServers = useSessionStore((s) => s.mcpServers);
  const storeSkills = useSessionStore((s) => s.skills);
  const storeExtensionVersion = useSessionStore((s) => s.extensionVersion);
  const storePublisher = useSessionStore((s) => s.publisher);
  const storeOpencodeVersion = useSessionStore((s) => s.opencodeVersion);
  const activeSessionID = useSessionStore((s) => s.activeSessionID);
  const sessions = useSessionStore((s) => s.sessions);
  const sessionDiffs = useSessionStore((s) => s.sessionDiffs);
  const { send } = useIPC(() => {});

  const lspServers = customLspServers ?? storeLspServers;
  const mcpServers = customMcpServers ?? storeMcpServers;
  const skills = customSkills ?? storeSkills;
  const extensionVersion = customExtensionVersion ?? storeExtensionVersion;
  const publisher = customPublisher ?? storePublisher;
  const opencodeVersion = customOpencodeVersion ?? storeOpencodeVersion;

  const activeSession = activeSessionID
    ? (sessions ?? []).find((s) => s.id === activeSessionID)
    : undefined;
  const hasRevert = !!activeSession?.revert?.messageID;
  const activeDiffs = activeSessionID ? (sessionDiffs[activeSessionID] ?? []) : [];

  const lspTooltipId = useTooltipContent(
    <>
      <strong>Language Servers (LSP)</strong>
      {lspServers.length === 0 ? (
        <div>No language servers active.</div>
      ) : (
        <table>
          <tbody>
            {lspServers.map((lsp) => (
              <tr key={lsp.name}>
                <td>{lsp.name}:</td>
                <td>
                  <span
                    style={{
                      color:
                        lsp.status === 'running'
                          ? 'var(--vscode-charts-green)'
                          : 'var(--vscode-charts-orange)',
                    }}
                  >
                    {lsp.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>,
  );
  const mcpTooltipId = useTooltipContent(
    <>
      <strong>Model Context Protocol (MCP)</strong>
      {mcpServers.length === 0 ? (
        <div>No MCP servers configured.</div>
      ) : (
        <table>
          <tbody>
            {mcpServers.map((mcp) => (
              <tr key={mcp.name}>
                <td>{mcp.name}:</td>
                <td>
                  <span
                    style={{
                      color:
                        mcp.status === 'connected' || mcp.status === 'running'
                          ? 'var(--vscode-charts-green)'
                          : 'var(--vscode-charts-red)',
                    }}
                  >
                    {mcp.status}
                  </span>
                  {mcp.error && (
                    <div style={{ color: 'var(--vscode-charts-red)', fontSize: '10px' }}>
                      {mcp.error}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>,
  );
  const skillsTooltipId = useTooltipContent(
    <>
      <strong>Discovered Skills</strong>
      {skills.length === 0 ? (
        <div>No custom skills discovered.</div>
      ) : (
        <ul>
          {skills.map((skill) => (
            <li key={skill.name}>
              <strong>{skill.name}</strong>
              {skill.description && (
                <div style={{ color: 'var(--vscode-descriptionForeground)', fontSize: '11px' }}>
                  {skill.description}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>,
  );
  const versionTooltipId = useTooltipContent(
    <>
      <strong>OpenCode Extension</strong>
      <table>
        <tbody>
          <tr>
            <td>Version:</td>
            <td>v{extensionVersion}</td>
          </tr>
          <tr>
            <td>Publisher:</td>
            <td>{publisher}</td>
          </tr>
          <tr>
            <td>OpenCode Version:</td>
            <td>v{opencodeVersion}</td>
          </tr>
          <tr>
            <td>Core SDK:</td>
            <td>@opencode-ai/sdk</td>
          </tr>
        </tbody>
      </table>
    </>,
  );

  return (
    <div className="prompt-input-header">
      <div
        className="metadata-item lsp"
        data-custom-title-content={lspTooltipId}
        data-testid="header-lsp"
      >
        <Codicon name="combine" className="metadata-icon" />
        <span>
          <span className="metadata-label">LSP: </span>
          {lspServers.length}
        </span>
      </div>

      <div
        className="metadata-item mcp"
        data-custom-title-content={mcpTooltipId}
        data-testid="header-mcp"
      >
        <Codicon name="plug" className="metadata-icon" />
        <span>
          <span className="metadata-label">MCP: </span>
          {mcpServers.length}
        </span>
      </div>

      <div
        className="metadata-item skills"
        data-custom-title-content={skillsTooltipId}
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
        data-custom-title-content={versionTooltipId}
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
