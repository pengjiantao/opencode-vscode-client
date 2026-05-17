/**
 * @file Renders a tool call part with its status, input, output, and error states.
 */

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

/** Displays a tool execution with status icon, input/output details, and error info. */
export function ToolPart({ tool, state }: ToolPartProps) {
  const getStatusIcon = () => {
    switch (state.status) {
      case 'pending':
        return '$(circle-outline)';
      case 'running':
        return '$(sync~spin)';
      case 'completed':
        return '$(check)';
      case 'error':
        return '$(error)';
      default:
        return '$(question)';
    }
  };

  return (
    <div className={`part tool-part status-${state.status}`}>
      <div className="tool-header">
        <span className="tool-icon">
          <Codicon name={getStatusIcon()} />
        </span>
        <span className="tool-name">{tool}</span>
        {state.title && <span className="tool-title">{state.title}</span>}
      </div>

      {state.input && (
        <div className="tool-input">
          <pre>{JSON.stringify(state.input, null, 2)}</pre>
        </div>
      )}

      {state.output && (
        <div className="tool-output">
          <pre>{state.output}</pre>
        </div>
      )}

      {state.error && (
        <div className="tool-error">
          <span className="error-icon">
            <Codicon name="$(error)" />
          </span>
          <pre>{state.error}</pre>
        </div>
      )}
    </div>
  );
}
