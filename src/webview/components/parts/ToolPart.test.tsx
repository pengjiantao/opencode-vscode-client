/**
 * @file Unit tests for the ToolPart component.
 * Verifies default collapsed/expanded behavior and lazy content mounting.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ToolPart } from './ToolPart';

const baseState = {
  status: 'completed' as const,
  input: { filePath: 'test.ts', content: 'const x = 1;' },
  output: 'done',
  title: 'Edit file test.ts',
  time: { start: 1000, end: 2000 },
  metadata: {
    diff: `--- a/test.ts\n+++ b/test.ts\n@@ -1 +1 @@\n-const x = 0;\n+const x = 1;`,
  },
};

describe('ToolPart', () => {
  describe('default collapsed state', () => {
    it('file edit tool defaults to expanded', () => {
      const { container } = render(<ToolPart tool="edit" state={baseState} />);
      expect(container.querySelector('.expanded')).toBeInTheDocument();
      expect(container.querySelector('.collapsed')).not.toBeInTheDocument();
    });

    it('write_to_file tool defaults to expanded', () => {
      const { container } = render(<ToolPart tool="write_to_file" state={baseState} />);
      expect(container.querySelector('.expanded')).toBeInTheDocument();
    });

    it('write tool defaults to expanded', () => {
      const { container } = render(<ToolPart tool="write" state={baseState} />);
      expect(container.querySelector('.expanded')).toBeInTheDocument();
    });

    it('apply_patch tool defaults to expanded', () => {
      const { container } = render(<ToolPart tool="apply_patch" state={baseState} />);
      expect(container.querySelector('.expanded')).toBeInTheDocument();
    });

    it('bash tool defaults to expanded', () => {
      const bashState = {
        ...baseState,
        input: { command: 'echo hello' },
        metadata: undefined,
      };
      const { container } = render(<ToolPart tool="bash" state={bashState} />);
      expect(container.querySelector('.expanded')).toBeInTheDocument();
      expect(container.querySelector('.collapsed')).not.toBeInTheDocument();
    });

    it('question tool defaults to expanded', () => {
      const questionState = {
        ...baseState,
        input: { questions: [{ question: 'Pick one' }] },
        metadata: undefined,
      };
      const { container } = render(<ToolPart tool="question" state={questionState} />);
      expect(container.querySelector('.expanded')).toBeInTheDocument();
    });

    it('non-specialized tool defaults to collapsed', () => {
      const grepState = {
        ...baseState,
        input: { query: 'test' },
        metadata: undefined,
      };
      const { container } = render(<ToolPart tool="grep_search" state={grepState} />);
      expect(container.querySelector('.collapsed')).toBeInTheDocument();
      expect(container.querySelector('.expanded')).not.toBeInTheDocument();
    });
  });

  describe('lazy content mounting', () => {
    it('does not mount content when initially collapsed (non-specialized tool)', () => {
      const grepState = {
        ...baseState,
        input: { query: 'test' },
        metadata: undefined,
      };
      const { container } = render(<ToolPart tool="grep_search" state={grepState} />);
      // Content should not be in the DOM at all (no collapsible-wrapper)
      expect(container.querySelector('.collapsible-wrapper')).not.toBeInTheDocument();
    });

    it('mounts content on first expand click for collapsed tool', () => {
      const grepState = {
        ...baseState,
        input: { query: 'test' },
        metadata: undefined,
      };
      const { container } = render(<ToolPart tool="grep_search" state={grepState} />);
      // Click the header to expand
      const header = container.querySelector('.tool-header')!;
      fireEvent.click(header);

      // Now the content should be mounted
      expect(container.querySelector('.collapsible-wrapper')).toBeInTheDocument();
      expect(container.querySelector('.expanded')).toBeInTheDocument();
    });

    it('keeps content mounted after collapsing', () => {
      const grepState = {
        ...baseState,
        input: { query: 'test' },
        metadata: undefined,
      };
      const { container } = render(<ToolPart tool="grep_search" state={grepState} />);
      const header = container.querySelector('.tool-header')!;

      // Expand
      fireEvent.click(header);
      expect(container.querySelector('.collapsible-wrapper')).toBeInTheDocument();

      // Collapse
      fireEvent.click(header);
      // Content should still be mounted (just hidden via CSS)
      expect(container.querySelector('.collapsible-wrapper')).toBeInTheDocument();
      expect(container.querySelector('.collapsed')).toBeInTheDocument();
    });

    it('mounts content immediately for default-expanded tools', () => {
      const bashState = {
        ...baseState,
        input: { command: 'echo hello' },
        metadata: undefined,
      };
      const { container } = render(<ToolPart tool="bash" state={bashState} />);
      // Content should be mounted from the start
      expect(container.querySelector('.collapsible-wrapper')).toBeInTheDocument();
    });

    it('mounts content immediately for edit tool (default expanded)', () => {
      const { container } = render(<ToolPart tool="edit" state={baseState} />);
      // Content should be mounted from the start for edit tools
      expect(container.querySelector('.collapsible-wrapper')).toBeInTheDocument();
      expect(container.querySelector('.diff-part-container')).toBeInTheDocument();
    });
  });

  describe('todowrite tool', () => {
    const todoInput = {
      todos: [
        { content: 'Read spec', status: 'completed', priority: 'high' },
        { content: 'Implement parser', status: 'in_progress', priority: 'medium' },
        { content: 'Write tests', status: 'pending', priority: 'low' },
        { content: 'Cancelled idea', status: 'cancelled', priority: 'low' },
      ],
    };

    it('renders with the tasklist codicon', () => {
      const state = { ...baseState, input: todoInput, metadata: undefined };
      const { container } = render(<ToolPart tool="todowrite" state={state} />);
      expect(container.querySelector('.codicon-tasklist')).toBeInTheDocument();
    });

    it('defaults to expanded and mounts the collapsible wrapper eagerly', () => {
      const state = { ...baseState, input: todoInput, metadata: undefined };
      const { container } = render(<ToolPart tool="todowrite" state={state} />);
      const toolPartEl = container.querySelector('.tool-part');
      expect(toolPartEl).toHaveClass('expanded');
      expect(toolPartEl).not.toHaveClass('collapsed');
      expect(container.querySelector('.collapsible-wrapper')).toBeInTheDocument();
    });

    it('summary shows "TODOS - X of Y completed" using the input list', () => {
      const state = { ...baseState, input: todoInput, metadata: undefined };
      render(<ToolPart tool="todowrite" state={state} />);
      expect(screen.getByText('TODOS - 1 of 4 completed')).toBeInTheDocument();
    });

    it('summary shows "0 of 0 completed" when todos input is missing', () => {
      const state = { ...baseState, input: {}, metadata: undefined };
      render(<ToolPart tool="todowrite" state={state} />);
      expect(screen.getByText('TODOS - 0 of 0 completed')).toBeInTheDocument();
    });

    it('summary falls back to "TODOS" when status is error', () => {
      const state = {
        ...baseState,
        status: 'error' as const,
        input: todoInput,
        metadata: undefined,
      };
      render(<ToolPart tool="todowrite" state={state} />);
      expect(screen.getByText('TODOS')).toBeInTheDocument();
    });

    it('summary counts "completed" items and ignores in_progress / pending / cancelled', () => {
      const state = {
        ...baseState,
        input: {
          todos: [
            { content: 'a', status: 'completed', priority: 'low' },
            { content: 'b', status: 'completed', priority: 'low' },
            { content: 'c', status: 'in_progress', priority: 'low' },
          ],
        },
        metadata: undefined,
      };
      render(<ToolPart tool="todowrite" state={state} />);
      expect(screen.getByText('TODOS - 2 of 3 completed')).toBeInTheDocument();
    });

    it('renders the structured checklist with one <li> per todo', () => {
      const state = { ...baseState, input: todoInput, metadata: undefined };
      const { container } = render(<ToolPart tool="todowrite" state={state} />);
      expect(container.querySelector('.todo-write-output')).toBeInTheDocument();
      const items = container.querySelectorAll('.todo-item');
      expect(items).toHaveLength(4);
    });

    it('does NOT render the generic tool-input JSON block', () => {
      const state = { ...baseState, input: todoInput, metadata: undefined };
      const { container } = render(<ToolPart tool="todowrite" state={state} />);
      expect(container.querySelector('.tool-input')).not.toBeInTheDocument();
    });

    it('applies status- and priority- class hooks to each item for styling', () => {
      const state = { ...baseState, input: todoInput, metadata: undefined };
      const { container } = render(<ToolPart tool="todowrite" state={state} />);
      expect(
        container.querySelector('.todo-item.status-completed.priority-high'),
      ).toBeInTheDocument();
      expect(
        container.querySelector('.todo-item.status-in_progress.priority-medium'),
      ).toBeInTheDocument();
      expect(container.querySelector('.todo-item.status-pending')).toBeInTheDocument();
      expect(container.querySelector('.todo-item.status-cancelled')).toBeInTheDocument();
    });

    it('regression: gracefully handles non-array todos input without crashing', () => {
      const state = {
        ...baseState,
        input: { todos: 'oops' as unknown as never[] },
        metadata: undefined,
      };
      const { container } = render(<ToolPart tool="todowrite" state={state} />);
      // Component still renders the header and falls back to the generic pre output
      expect(container.querySelector('.tool-header')).toBeInTheDocument();
      expect(container.querySelector('.todo-write-output')).not.toBeInTheDocument();
    });
  });
});
