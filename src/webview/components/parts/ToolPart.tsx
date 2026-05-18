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
}

/** Displays a tool execution in a collapsible borderless box, default collapsed. */
export function ToolPart({ tool, state }: ToolPartProps) {
  const [collapsed, setCollapsed] = useState(true);

  const getSummaryText = () => {
    const statusText =
      state.status === 'running' ? ' (running...)' : state.status === 'error' ? ' (failed)' : '';
    return `Tool: ${tool}${state.title ? ` - ${state.title}` : ''}${statusText}`;
  };

  return (
    <div
      className={`part tool-part status-${state.status} ${collapsed ? 'collapsed' : 'expanded'}`}
    >
      <div className="tool-header" onClick={() => setCollapsed(!collapsed)}>
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
          {state.input && (
            <div className="tool-input">
              <span className="section-label">Input</span>
              <pre>{JSON.stringify(state.input, null, 2)}</pre>
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
