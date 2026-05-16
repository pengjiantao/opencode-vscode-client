import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PromptInput } from './PromptInput';

vi.mock('@vscode/webview-ui-toolkit/react', () => ({
  VSCodeButton: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  VSCodeTextArea: ({
    value,
    onInput,
    placeholder,
  }: {
    value?: string;
    onInput?: (e: React.FormEvent<HTMLTextAreaElement>) => void;
    placeholder?: string;
  }) => <textarea value={value} onInput={onInput} placeholder={placeholder} />,
  VSCodeDropdown: ({
    children,
    onChange,
    'aria-label': ariaLabel,
  }: {
    children?: React.ReactNode;
    onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    'aria-label'?: string;
  }) => (
    <select aria-label={ariaLabel} onChange={onChange}>
      {children}
    </select>
  ),
  VSCodeOption: ({ children, value }: { children?: React.ReactNode; value?: string }) => (
    <option value={value}>{children}</option>
  ),
}));

const mockOnSubmit = vi.fn();
const mockOnModelChange = vi.fn();
const mockOnAgentChange = vi.fn();

describe('PromptInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders text area with placeholder', () => {
    render(
      <PromptInput
        onSubmit={mockOnSubmit}
        models={[{ id: 'model-1', name: 'Model 1' }]}
        agents={[{ id: 'agent-1', name: 'Agent 1' }]}
        onModelChange={mockOnModelChange}
        onAgentChange={mockOnAgentChange}
      />,
    );

    expect(
      screen.getByPlaceholderText('Type a message... (Shift+Enter for new line)'),
    ).toBeInTheDocument();
  });

  it('renders model and agent dropdowns', () => {
    render(
      <PromptInput
        onSubmit={mockOnSubmit}
        models={[{ id: 'model-1', name: 'Model 1' }]}
        agents={[{ id: 'agent-1', name: 'Agent 1' }]}
        onModelChange={mockOnModelChange}
        onAgentChange={mockOnAgentChange}
      />,
    );

    expect(screen.getByRole('combobox', { name: /select model/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /select agent/i })).toBeInTheDocument();
  });

  it('calls onSubmit when send button is clicked', () => {
    render(
      <PromptInput
        onSubmit={mockOnSubmit}
        models={[{ id: 'model-1', name: 'Model 1' }]}
        agents={[{ id: 'agent-1', name: 'Agent 1' }]}
        onModelChange={mockOnModelChange}
        onAgentChange={mockOnAgentChange}
      />,
    );

    const textarea = screen.getByPlaceholderText('Type a message... (Shift+Enter for new line)');
    fireEvent.input(textarea, { target: { value: 'Hello world' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(mockOnSubmit).toHaveBeenCalled();
  });

  it('does not call onSubmit when input is empty', () => {
    render(
      <PromptInput
        onSubmit={mockOnSubmit}
        models={[{ id: 'model-1', name: 'Model 1' }]}
        agents={[{ id: 'agent-1', name: 'Agent 1' }]}
        onModelChange={mockOnModelChange}
        onAgentChange={mockOnAgentChange}
      />,
    );

    const textarea = screen.getByPlaceholderText('Type a message... (Shift+Enter for new line)');
    fireEvent.input(textarea, { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });
});
