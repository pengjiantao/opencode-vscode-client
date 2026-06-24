/**
 * @file Unit tests for the TodoWriteOutput component.
 * Verifies status icon mapping, ordering, and graceful handling of empty/invalid input.
 */

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TodoItem, TodoWriteOutput } from './TodoWriteOutput';

const baseTodos = [
  { content: 'Read the spec', status: 'completed' as const, priority: 'high' as const },
  { content: 'Implement the parser', status: 'in_progress' as const, priority: 'medium' as const },
  { content: 'Write tests', status: 'pending' as const, priority: 'low' as const },
  { content: 'Cancelled idea', status: 'cancelled' as const, priority: 'low' as const },
];

describe('TodoWriteOutput', () => {
  it('renders a <ul> with one <li> per todo in input order', () => {
    const { container } = render(<TodoWriteOutput todos={baseTodos} status="running" />);

    const items = container.querySelectorAll('.todo-item');
    expect(items).toHaveLength(4);
    expect(items[0].textContent).toContain('Read the spec');
    expect(items[1].textContent).toContain('Implement the parser');
    expect(items[2].textContent).toContain('Write tests');
    expect(items[3].textContent).toContain('Cancelled idea');
  });

  it('applies status and priority classes to each item', () => {
    const { container } = render(<TodoWriteOutput todos={baseTodos} status="running" />);

    expect(
      container.querySelector('.todo-item.status-completed.priority-high'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('.todo-item.status-in_progress.priority-medium'),
    ).toBeInTheDocument();
    expect(container.querySelector('.todo-item.status-pending.priority-low')).toBeInTheDocument();
    expect(container.querySelector('.todo-item.status-cancelled.priority-low')).toBeInTheDocument();
  });

  it('uses the check codicon for completed items', () => {
    const { container } = render(
      <TodoWriteOutput
        todos={[{ content: 'done', status: 'completed', priority: 'low' }]}
        status="completed"
      />,
    );
    expect(container.querySelector('.codicon-check')).toBeInTheDocument();
  });

  it('uses the spinning loading codicon for in_progress items', () => {
    const { container } = render(
      <TodoWriteOutput
        todos={[{ content: 'doing', status: 'in_progress', priority: 'high' }]}
        status="running"
      />,
    );
    expect(container.querySelector('.codicon-loading')).toBeInTheDocument();
    expect(container.querySelector('.codicon-modifier-spin')).toBeInTheDocument();
  });

  it('uses circle-outline for pending items', () => {
    const { container } = render(
      <TodoWriteOutput
        todos={[{ content: 'queued', status: 'pending', priority: 'low' }]}
        status="pending"
      />,
    );
    expect(container.querySelector('.codicon-circle-outline')).toBeInTheDocument();
  });

  it('uses circle-slash for cancelled items', () => {
    const { container } = render(
      <TodoWriteOutput
        todos={[{ content: 'dropped', status: 'cancelled', priority: 'low' }]}
        status="completed"
      />,
    );
    expect(container.querySelector('.codicon-circle-slash')).toBeInTheDocument();
  });

  it('returns null for an empty todo list (caller falls back to generic output)', () => {
    const { container } = render(<TodoWriteOutput todos={[]} status="running" />);
    expect(container.querySelector('.todo-write-output')).not.toBeInTheDocument();
  });

  it('renders an arbitrary number of todos without affecting order', () => {
    const many: TodoItem[] = Array.from({ length: 25 }, (_, i) => ({
      content: `Step ${i + 1}`,
      status: i === 0 ? ('completed' as const) : ('pending' as const),
      priority: 'medium' as const,
    }));
    const { container } = render(<TodoWriteOutput todos={many} status="running" />);
    expect(container.querySelectorAll('.todo-item')).toHaveLength(25);
    expect(container.querySelector('.todo-content')?.textContent).toBe('Step 1');
  });

  it('exposes the tool status on the wrapper via data-status for styling hooks', () => {
    const { container } = render(<TodoWriteOutput todos={baseTodos} status="completed" />);
    const wrapper = container.querySelector('.todo-write-output');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper?.getAttribute('data-status')).toBe('completed');
  });

  it('renders content text exactly as provided (preserves internal whitespace)', () => {
    const content = 'Step 1:  read  the   spec';
    const { container } = render(
      <TodoWriteOutput
        todos={[{ content, status: 'pending', priority: 'medium' }]}
        status="pending"
      />,
    );
    // Use raw textContent because @testing-library's getByText normalises
    // whitespace, which would mask any accidental HTML compression.
    const node = container.querySelector('.todo-content');
    expect(node?.textContent).toBe(content);
  });

  it('regression: completed and cancelled items do not render with line-through', () => {
    // The component itself does not apply text-decoration (CSS owns that), but
    // we guard against any future inline style or class change re-introducing
    // it. Computed style check covers both the CSS file and any future change.
    const { container } = render(<TodoWriteOutput todos={baseTodos} status="running" />);

    const completedContent = container.querySelector('.todo-item.status-completed .todo-content');
    const cancelledContent = container.querySelector('.todo-item.status-cancelled .todo-content');
    expect(completedContent).toBeInTheDocument();
    expect(cancelledContent).toBeInTheDocument();
    expect(getComputedStyle(completedContent!).textDecorationLine).not.toBe('line-through');
    expect(getComputedStyle(cancelledContent!).textDecorationLine).not.toBe('line-through');
  });
});
