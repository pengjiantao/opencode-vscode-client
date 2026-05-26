/**
 * @file Renders a specialized tool part for sub-agent delegation ('task' tool calls).
 * Monitors sub-agent step changes, displays tool call counts and elapsed durations,
 * parses final task outcomes, and provides interactive links to switch into the sub-agent's session tab.
 */

import type { Message, Part } from '@opencode-ai/sdk/v2/client';
import { useMemo, useState } from 'react';
import { useSessionStore } from '../../store/sessionStore';
import { Codicon } from '../Codicon';
import { getToolDescription } from './ToolPart';

interface TaskToolPartProps {
  /** The tool name (usually 'task'). */
  tool: string;
  /** Current state of the tool execution. */
  state: {
    status: 'pending' | 'running' | 'completed' | 'error';
    input?: Record<string, unknown>;
    output?: string;
    title?: string;
    error?: string;
    time?: { start: number; end?: number };
    metadata?: Record<string, unknown>;
  };
  /** Whether there is a predecessor item in the timeline. */
  hasPredecessor?: boolean;
  /** Whether there is a successor item in the timeline. */
  hasSuccessor?: boolean;
}

/**
 * Formats a duration in milliseconds into a user-friendly string (e.g., "1m 15s" or "23s").
 *
 * @param ms Duration in milliseconds.
 * @returns Human-readable duration string.
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Parses and extracts the sub-agent output text from between the <task_result> tag boundaries.
 * Falls back to the raw output string if tags are not present.
 *
 * @param output The raw output string returned by the task tool.
 * @returns The parsed result content.
 */
function extractTaskResult(output?: string): string {
  if (!output) {
    return '';
  }
  const match = output.match(/<task_result>([\s\S]*?)<\/task_result>/);
  if (match) {
    return match[1].trim();
  }
  return output.trim();
}

/**
 * Deduces the current execution state of a child session by inspecting its message timeline history.
 *
 * @param childMessages Active messages of the sub-agent session.
 * @param partsMap Store dictionary mapping message IDs to their respective part lists.
 * @returns Human-readable state step describing the current operation.
 */
function getCurrentStep(childMessages: Message[], partsMap: Record<string, Part[]>): string {
  if (childMessages.length === 0) {
    return 'Thinking';
  }
  const lastMsg = childMessages[childMessages.length - 1];
  if (lastMsg.role !== 'assistant') {
    return 'Thinking';
  }
  const msgParts = partsMap[lastMsg.id] || [];
  if (msgParts.length === 0) {
    return 'Thinking';
  }
  const lastPart = msgParts[msgParts.length - 1];
  if (lastPart.type === 'reasoning') {
    return 'Thinking';
  }
  if (lastPart.type === 'tool') {
    const toolState = lastPart.state as
      | { input?: Record<string, unknown>; title?: string }
      | undefined;
    const desc = getToolDescription(lastPart.tool, toolState?.input, toolState?.title);
    return `Tool: ${desc}`;
  }
  if (lastPart.type === 'text') {
    return 'Outputting';
  }
  return 'Thinking';
}

const EMPTY_MESSAGES: Message[] = [];

/** Displays sub-agent tasks, collapsing on finish and displaying interactive links/stats. */
export function TaskToolPart({
  state,
  hasPredecessor = false,
  hasSuccessor = false,
}: TaskToolPartProps) {
  const childSessionID = state.metadata?.sessionId as string | undefined;
  const description = (state.input?.description as string | undefined) || '';

  // Retrieve messages and parts from the session store for the child session
  const childMessages = useSessionStore(
    (s) => (childSessionID ? s.messages[childSessionID] : undefined) || EMPTY_MESSAGES,
  );
  const allParts = useSessionStore((s) => s.parts);

  // Compute the total tool calls executed by the sub-agent
  const toolCallCount = useMemo(() => {
    return childMessages.reduce((count, msg) => {
      if (msg.role === 'assistant') {
        const msgParts = allParts[msg.id] || [];
        return count + msgParts.filter((p) => p.type === 'tool').length;
      }
      return count;
    }, 0);
  }, [childMessages, allParts]);

  const currentStep = useMemo(() => {
    return getCurrentStep(childMessages, allParts);
  }, [childMessages, allParts]);
  const isExecuting = state.status === 'running' || state.status === 'pending';
  const isFinished = state.status === 'completed' || state.status === 'error';

  const [prevStatus, setPrevStatus] = useState(state.status);
  const [collapsed, setCollapsed] = useState(true);

  // Synchronously adjust state when status prop changes during render
  if (state.status !== prevStatus) {
    setPrevStatus(state.status);
    if (isExecuting) {
      setCollapsed(false);
    } else if (isFinished) {
      setCollapsed(true);
    }
  }

  /** Triggers IPC switch to the sub-agent session tab. */
  const handleOpenSubagent = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (childSessionID) {
      window.vscode.postMessage({
        type: 'session:switch',
        sessionID: childSessionID,
      });
    }
  };

  const startTime = state.time?.start;
  const endTime = state.time?.end;
  const durationMs = startTime && endTime ? endTime - startTime : 0;
  const durationText = formatDuration(durationMs);

  const promptInput = (state.input?.prompt as string | undefined) || '';
  const finalOutput = extractTaskResult(state.output);

  const showLine = hasPredecessor || hasSuccessor;
  const dotClassName = `timeline-dot tool-dot status-${state.status}`;

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
        <Codicon name="$(checklist)" className="tool-header-icon" />
        <span className="tool-name">
          {state.title || description || 'TASK'}
          {isFinished && (
            <span className="task-header-stats">
              {' - '}
              <button className="subagent-interactive-link" onClick={handleOpenSubagent}>
                Called tool {toolCallCount} times
              </button>
              {` (took ${durationText})`}
            </span>
          )}
        </span>
      </div>

      {isFinished && (
        <div className="task-finished-container">
          {promptInput && (
            <div className="tool-input">
              <span className="section-label">Prompt Input</span>
              <pre>{promptInput}</pre>
            </div>
          )}
          {finalOutput && (
            <div className="tool-output">
              <span className="section-label">Sub-agent Output</span>
              <pre>{finalOutput}</pre>
            </div>
          )}
        </div>
      )}

      <div
        className="collapsible-wrapper"
        style={{
          maxHeight: collapsed ? 0 : '2000px',
          opacity: collapsed ? 0 : 1,
          overflow: 'hidden',
        }}
      >
        <div className="tool-content">
          {isExecuting && (
            <div className="subagent-executing-details">
              <div className="subagent-status-row">
                <span className="spinner-wrapper">
                  <Codicon name="loading" className="spin" />
                </span>
                <span className="status-label">Executing: </span>
                <button className="subagent-interactive-link" onClick={handleOpenSubagent}>
                  {currentStep}
                </button>
              </div>
            </div>
          )}

          {isFinished && !collapsed && (
            <div className="subagent-finished-details">
              <button className="subagent-interactive-link" onClick={handleOpenSubagent}>
                View sub-agent session details
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
