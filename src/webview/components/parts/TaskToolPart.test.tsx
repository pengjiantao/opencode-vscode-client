/**
 * @file Unit tests for the TaskToolPart component.
 * Verifies executing, finished, and error states, automatic expanding/collapsing,
 * statistical aggregations (tool call counts and durations), and interactive tab switching.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskToolPart } from './TaskToolPart';

// Mock useSessionStore to return custom mock state for child sessions
vi.mock('../../store/sessionStore', () => ({
  useSessionStore: vi.fn(<T,>(selector: (state: Record<string, unknown>) => T): T => {
    const state = {
      messages: {
        'child-session-123': [
          { id: 'child-msg-1', role: 'user', sessionID: 'child-session-123' },
          { id: 'child-msg-2', role: 'assistant', sessionID: 'child-session-123' },
        ],
        'child-session-456': [
          { id: 'child-msg-3', role: 'user', sessionID: 'child-session-456' },
          { id: 'child-msg-4', role: 'assistant', sessionID: 'child-session-456' },
        ],
      },
      parts: {
        'child-msg-2': [
          { id: 'child-part-1', messageID: 'child-msg-2', type: 'tool', tool: 'write_to_file' },
          { id: 'child-part-2', messageID: 'child-msg-2', type: 'text', text: 'Step finished' },
        ],
        'child-msg-4': [
          {
            id: 'child-part-3',
            messageID: 'child-msg-4',
            type: 'tool',
            tool: 'read_file',
            state: {
              status: 'running',
              input: { AbsolutePath: '/workspace/src/index.ts' },
              title: 'Reading file index.ts',
            },
          },
        ],
      },
      loadedChildSessions: new Set(['child-session-123', 'child-session-456']),
      fetchChildSession: vi.fn(),
    };
    return selector(state);
  }),
}));

describe('TaskToolPart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders executing sub-agent with current step details', () => {
    const state = {
      status: 'running' as const,
      input: {
        description: 'Run project tests',
        prompt: 'Run tests in directory',
      },
      metadata: {
        sessionId: 'child-session-123',
      },
      time: { start: Date.now() },
    };

    render(<TaskToolPart tool="task" state={state} />);

    // Check task title/description is rendered
    expect(screen.getByText(/Run project tests/)).toBeInTheDocument();

    // Check step is rendered (getCurrentStep should return 'Outputting' as last part is 'text')
    expect(screen.getAllByText('Outputting')[0]).toBeInTheDocument();

    // Interactivity test: click on the step should send switch session postMessage
    const stepLink = screen.getAllByRole('button', { name: 'Outputting' })[0];
    fireEvent.click(stepLink);

    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'session:switch',
      sessionID: 'child-session-123',
    });
  });

  it('renders completed sub-agent with tool call counts and elapsed duration', () => {
    const startTime = Date.now() - 75000; // 1m 15s ago
    const state = {
      status: 'completed' as const,
      input: {
        description: 'Run project tests',
        prompt: 'Run tests in directory',
      },
      metadata: {
        sessionId: 'child-session-123',
      },
      output:
        'task_id: child-session-123\n\n<task_result>\nTests passed successfully.\n</task_result>',
      time: { start: startTime, end: Date.now() },
    };

    const { container } = render(<TaskToolPart tool="task" state={state} />);

    // Should display 'Called tool 1 times' as only 1 tool part was mock-returned
    expect(screen.getByText('Called tool 1 times')).toBeInTheDocument();

    // Should display duration text containing 1m 15s (75 seconds)
    expect(screen.getByText(/\(took 1m 15s\)/)).toBeInTheDocument();

    // Check prompt and output are wrapped and displayed as Markdown
    expect(screen.getByText('Prompt Input')).toBeInTheDocument();
    expect(container.querySelector('.tool-input .markdown-body')).toBeInTheDocument();
    expect(screen.getByText('Run tests in directory')).toBeInTheDocument();
    expect(screen.getByText('Sub-agent Output')).toBeInTheDocument();
    expect(container.querySelector('.tool-output .markdown-body')).toBeInTheDocument();
    expect(screen.getByText('Tests passed successfully.')).toBeInTheDocument();

    // Interactivity test: click on the call count link should switch to sub-agent
    const statsLink = screen.getByRole('button', { name: 'Called tool 1 times' });
    fireEvent.click(statsLink);

    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'session:switch',
      sessionID: 'child-session-123',
    });
  });

  it('renders executing step using getToolDescription when running a tool', () => {
    const state = {
      status: 'running' as const,
      input: {
        description: 'Read main index file',
      },
      metadata: {
        sessionId: 'child-session-456',
      },
      time: { start: Date.now() },
    };

    render(<TaskToolPart tool="task" state={state} />);

    // Renders the specific tool step name in the details block
    expect(screen.getByText('Tool: Reading file index.ts')).toBeInTheDocument();

    // Verify executing header step is not rendered (header has only title/description)
    expect(screen.queryByText(' - Tool: Reading file index.ts')).not.toBeInTheDocument();
  });

  it('regression: auto-collapse on completion has no CSS transition to prevent flash', () => {
    const { rerender } = render(
      <TaskToolPart
        tool="task"
        state={{
          status: 'running',
          input: { description: 'Run tests' },
          metadata: { sessionId: 'child-session-123' },
          time: { start: Date.now() },
        }}
      />,
    );

    // During execution, wrapper should have CSS transition (no isAutoCollapsing)
    const wrapper = document.querySelector('.collapsible-wrapper');
    expect(wrapper).not.toHaveStyle({ transition: 'none' });

    // Transition to completed state
    rerender(
      <TaskToolPart
        tool="task"
        state={{
          status: 'completed',
          input: { description: 'Run tests', prompt: 'Run tests' },
          metadata: { sessionId: 'child-session-123' },
          output: '<task_result>Done</task_result>',
          time: { start: Date.now() - 5000, end: Date.now() },
        }}
      />,
    );

    // Immediately after completion, transition should be 'none' (auto-collapse)
    expect(wrapper).toHaveStyle({ transition: 'none' });

    // Finished content should NOT be visible during auto-collapse
    expect(screen.queryByText('Prompt Input')).not.toBeInTheDocument();
    expect(screen.queryByText('Sub-agent Output')).not.toBeInTheDocument();
  });

  it('regression: finished content appears after auto-collapse completes', async () => {
    const { rerender } = render(
      <TaskToolPart
        tool="task"
        state={{
          status: 'running',
          input: { description: 'Run tests' },
          metadata: { sessionId: 'child-session-123' },
          time: { start: Date.now() },
        }}
      />,
    );

    // Transition to completed state
    rerender(
      <TaskToolPart
        tool="task"
        state={{
          status: 'completed',
          input: { description: 'Run tests', prompt: 'Run tests' },
          metadata: { sessionId: 'child-session-123' },
          output: '<task_result>Done</task_result>',
          time: { start: Date.now() - 5000, end: Date.now() },
        }}
      />,
    );

    // Wait for requestAnimationFrame to clear isAutoCollapsing
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      // Allow React to flush the state update
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // After auto-collapse completes, finished content should be visible
    expect(screen.getByText('Prompt Input')).toBeInTheDocument();
    expect(screen.getByText('Sub-agent Output')).toBeInTheDocument();
    expect(screen.getAllByText('Run tests').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Done')).toBeInTheDocument();
  });
});
