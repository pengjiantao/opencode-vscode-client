/**
 * @file Unit tests for PromptInput — submission, empty validation, dropdowns, and regression tests.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PromptInput } from './PromptInput';

vi.mock('@vscode/webview-ui-toolkit/react', () => ({
  VSCodeButton: ({
    children,
    onClick,
    className,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} className={className} disabled={disabled}>
      {children}
    </button>
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
    disabled,
    'aria-label': ariaLabel,
  }: {
    children?: React.ReactNode;
    onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    disabled?: boolean;
    'aria-label'?: string;
  }) => (
    <select aria-label={ariaLabel} onChange={onChange} disabled={disabled}>
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

  /** Regression: dropdowns should be disabled when empty, enabled when populated. */
  it('regression: enables model and agent dropdowns after loading data', () => {
    const { rerender } = render(
      <PromptInput
        onSubmit={mockOnSubmit}
        models={[]}
        agents={[]}
        onModelChange={mockOnModelChange}
        onAgentChange={mockOnAgentChange}
      />,
    );

    const modelSelect = screen.getByRole('combobox', { name: /select model/i });
    const agentSelect = screen.getByRole('combobox', { name: /select agent/i });

    expect(modelSelect).toBeDisabled();
    expect(agentSelect).toBeDisabled();

    rerender(
      <PromptInput
        onSubmit={mockOnSubmit}
        models={[{ id: 'model-1', name: 'Model 1' }]}
        agents={[{ id: 'agent-1', name: 'Agent 1' }]}
        onModelChange={mockOnModelChange}
        onAgentChange={mockOnAgentChange}
      />,
    );

    expect(modelSelect).not.toBeDisabled();
    expect(agentSelect).not.toBeDisabled();
  });

  /** Regression: send button becomes a stop button with warning colors when busy/retry. */
  it('regression: transitions button to stop (warning appearance) when status is busy or retry', () => {
    const mockOnAbort = vi.fn();
    const { rerender } = render(
      <PromptInput
        onSubmit={mockOnSubmit}
        onAbort={mockOnAbort}
        status={{ type: 'idle' }}
        models={[]}
        agents={[]}
        onModelChange={mockOnModelChange}
        onAgentChange={mockOnAgentChange}
      />,
    );

    const sendBtn = screen.getByRole('button', { name: /send/i });
    expect(sendBtn).toHaveTextContent('Send');
    expect(sendBtn).not.toHaveClass('stop-btn');

    rerender(
      <PromptInput
        onSubmit={mockOnSubmit}
        onAbort={mockOnAbort}
        status={{ type: 'busy' }}
        models={[]}
        agents={[]}
        onModelChange={mockOnModelChange}
        onAgentChange={mockOnAgentChange}
      />,
    );

    const stopBtn = screen.getByRole('button', { name: /stop/i });
    expect(stopBtn).toHaveTextContent('Stop');
    expect(stopBtn).toHaveClass('stop-btn');

    fireEvent.click(stopBtn);
    expect(mockOnAbort).toHaveBeenCalledTimes(1);
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  /** Regression: subagents and hidden agents should be filtered out of the agent list. */
  it('regression: AgentSelector only lists primary (non-subagent and non-hidden) agents', () => {
    const agents = [
      { id: 'build', name: 'Build Agent', mode: 'primary', hidden: false },
      { id: 'plan', name: 'Plan Agent', mode: 'primary', hidden: false },
      { id: 'sub', name: 'Sub Agent', mode: 'subagent', hidden: false },
      { id: 'hide', name: 'Hidden Agent', mode: 'primary', hidden: true },
    ];
    render(
      <PromptInput
        onSubmit={mockOnSubmit}
        models={[]}
        agents={agents}
        onModelChange={mockOnModelChange}
        onAgentChange={mockOnAgentChange}
      />,
    );

    const trigger = screen.getByRole('combobox', { name: /select agent/i });
    fireEvent.click(trigger);

    expect(screen.queryAllByText('Build Agent').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Plan Agent').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Sub Agent').length).toBe(0);
    expect(screen.queryAllByText('Hidden Agent').length).toBe(0);
  });

  /** Regression: only connected (non-disconnected) models should appear, and search should filter. */
  it('regression: ModelSelector only lists connected models and allows searching', () => {
    const models = [
      { id: 'm1', name: 'GPT-4', providerName: 'OpenAI', isConnected: true },
      { id: 'm2', name: 'Claude', providerName: 'Anthropic', isConnected: true },
      { id: 'm3', name: 'Gemini', providerName: 'Google', isConnected: false },
    ];
    render(
      <PromptInput
        onSubmit={mockOnSubmit}
        models={models}
        agents={[]}
        onModelChange={mockOnModelChange}
        onAgentChange={mockOnAgentChange}
      />,
    );

    const trigger = screen.getByRole('combobox', { name: /select model/i });
    fireEvent.click(trigger);

    expect(screen.queryAllByText('GPT-4').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Claude').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Gemini').length).toBe(0);

    const searchInput = screen.getByPlaceholderText('Search models...');
    fireEvent.change(searchInput, { target: { value: 'GPT' } });

    expect(screen.queryAllByText('GPT-4').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Claude').length).toBe(0);
  });
});
