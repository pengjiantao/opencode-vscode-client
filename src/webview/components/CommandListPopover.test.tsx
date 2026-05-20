/**
 * @file Unit tests for CommandListPopover command/skill search component.
 * Verifies rendering with command and skill sources, skills-only empty text, and click callbacks.
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommandListPopover } from './CommandListPopover';

describe('CommandListPopover', () => {
  const results = [
    { name: 'review', description: 'Review code changes', source: 'command' as const },
    {
      name: 'customize-opencode',
      description: 'Customize opencode config',
      source: 'skill' as const,
    },
    { name: 'git-status', description: 'Run git status via MCP', source: 'mcp' as const },
  ];

  it('should render nothing when show is false', () => {
    const { container } = render(
      <CommandListPopover
        show={false}
        results={results}
        selectedIndex={0}
        onSelect={vi.fn()}
        skillsOnly={false}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render all items with names and descriptions', () => {
    render(
      <CommandListPopover
        show={true}
        results={results}
        selectedIndex={0}
        onSelect={vi.fn()}
        skillsOnly={false}
      />,
    );
    expect(screen.getByText('review')).toBeInTheDocument();
    expect(screen.getByText('Review code changes')).toBeInTheDocument();
    expect(screen.getByText('customize-opencode')).toBeInTheDocument();
    expect(screen.getByText('git-status')).toBeInTheDocument();
  });

  it('should show skills-only empty text when skillsOnly is true', () => {
    render(
      <CommandListPopover
        show={true}
        results={[]}
        selectedIndex={0}
        onSelect={vi.fn()}
        skillsOnly={true}
      />,
    );
    expect(screen.getByText('No matching skills found')).toBeInTheDocument();
  });

  it('should show commands+skills empty text when skillsOnly is false', () => {
    render(
      <CommandListPopover
        show={true}
        results={[]}
        selectedIndex={0}
        onSelect={vi.fn()}
        skillsOnly={false}
      />,
    );
    expect(screen.getByText('No matching commands or skills found')).toBeInTheDocument();
  });

  it('should call onSelect when an item is clicked', () => {
    const onSelect = vi.fn();
    render(
      <CommandListPopover
        show={true}
        results={results}
        selectedIndex={0}
        onSelect={onSelect}
        skillsOnly={false}
      />,
    );
    fireEvent.click(screen.getByText('review'));
    expect(onSelect).toHaveBeenCalledWith(results[0]);
  });

  it('should render codicon icons for each source type', () => {
    const { container } = render(
      <CommandListPopover
        show={true}
        results={results}
        selectedIndex={0}
        onSelect={vi.fn()}
        skillsOnly={false}
      />,
    );
    expect(container.querySelector('.codicon-symbol-method')).toBeInTheDocument();
    expect(container.querySelector('.codicon-lightbulb')).toBeInTheDocument();
    expect(container.querySelector('.codicon-server-process')).toBeInTheDocument();
  });
});
