/**
 * @file Renders a tool call part with its status, input, output, and error states in a borderless collapsible block.
 */

import { useState } from 'react';
import { Codicon } from '../Codicon';

interface ToolPartProps {
  tool: string;
  state: {
    status: 'pending' | 'running' | 'completed' | 'error';
    input?: Record<string, unknown>;
    output?: string;
    title?: string;
    error?: string;
    time?: { start: number; end?: number };
  };
  hasPredecessor?: boolean;
  hasSuccessor?: boolean;
}

/**
 * Resolves the appropriate VS Code Codicon class name or identifier for a given tool name.
 * Maps common tools like bash, grep, search, files, and browsers to their corresponding icons.
 *
 * @param tool The raw tool name (e.g., 'bash', 'grep_search', 'write_to_file')
 * @returns The codicon icon name string (e.g., '$(terminal)')
 */
// eslint-disable-next-line react-refresh/only-export-components
export function getToolIcon(tool: string): string {
  const name = tool.toLowerCase();
  // Match specialized browser/web search tools first before general search to avoid keyword overlap (e.g., browser_search)
  if (name.includes('browser') || name.includes('web') || name.includes('url')) {
    return '$(browser)';
  }
  // Map bash/terminal commands to terminal icon
  if (
    name.includes('bash') ||
    name.includes('command') ||
    name.includes('terminal') ||
    name.includes('run_command')
  ) {
    return '$(terminal)';
  }
  // Map search / pattern matching to search icon
  if (name.includes('grep') || name.includes('search')) {
    return '$(search)';
  }
  // Map list_dir / folder operations to folder icon
  if (name.includes('list_dir') || name.includes('list_directory') || name.includes('folder')) {
    return '$(folder)';
  }
  // Map edit / write / save operations to edit icon
  if (
    name.includes('write') ||
    name.includes('replace') ||
    name.includes('edit') ||
    name.includes('save')
  ) {
    return '$(edit)';
  }
  // Map read / view file operations to file-code icon
  if (name.includes('read') || name.includes('view') || name.includes('file')) {
    return '$(file-code)';
  }
  // Fallback to a general toolbox/tools icon
  return '$(tools)';
}

/** Displays a tool execution in a collapsible borderless box, default collapsed. */
export function ToolPart({
  tool,
  state,
  hasPredecessor = false,
  hasSuccessor = false,
}: ToolPartProps) {
  const [collapsed, setCollapsed] = useState(true);

  // Omit "Tool:" prefix to keep the sidebar presentation compact and developer-centric
  const getSummaryText = () => {
    return `${tool.toUpperCase()}${state.title ? ` - ${state.title}` : ''}`;
  };

  const dotClassName = `timeline-dot tool-dot status-${state.status}`;
  const showLine = hasPredecessor || hasSuccessor;

  return (
    <div
      className={`part tool-part timeline-item status-${state.status} ${collapsed ? 'collapsed' : 'expanded'}`}
    >
      <span className={dotClassName} />
      {showLine && (
        <span
          className={`timeline-line${hasPredecessor ? ' has-predecessor' : ''}${hasSuccessor ? ' has-successor' : ''}`}
        />
      )}
      <div className="tool-header" onClick={() => setCollapsed(!collapsed)}>
        <Codicon name={getToolIcon(tool)} className="tool-header-icon" />
        <span className="tool-name">{getSummaryText()}</span>
      </div>

      <div
        className="collapsible-wrapper"
        style={{
          maxHeight: collapsed ? 0 : '2000px',
          opacity: collapsed ? 0 : 1,
          overflow: 'hidden',
        }}
      >
        <div className="tool-content">
          {state.input && Object.keys(state.input).length > 0 && (
            <div className="tool-input">
              <pre>
                {Object.entries(state.input)
                  .map(([key, value]) => {
                    const upperKey = key.toUpperCase();
                    const displayVal =
                      typeof value === 'object' && value !== null
                        ? JSON.stringify(value)
                        : String(value);
                    return `${upperKey} ${displayVal}`;
                  })
                  .join('\n')}
              </pre>
            </div>
          )}

          {state.output && (
            <div className="tool-output">
              <span className="section-label">Output</span>
              <pre>{state.output}</pre>
            </div>
          )}

          {state.error && (
            <div className="tool-error">
              <span className="error-title">
                <Codicon name="$(error)" /> Error
              </span>
              <pre>{state.error}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
