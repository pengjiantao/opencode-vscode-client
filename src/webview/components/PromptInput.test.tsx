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

vi.mock('../store/sessionStore', () => ({
  useSessionStore: vi.fn(<T,>(selector: (state: Record<string, unknown>) => T): T => {
    const state = {
      workspaceName: 'TestWorkspace',
      lspServers: [{ name: 'typescript-lsp', status: 'running' }],
      mcpServers: [{ name: 'git-mcp', status: 'connected' }],
      skills: [{ name: 'customize-opencode', description: 'desc' }],
      plugins: ['plugin-1'],
      extensionVersion: '0.1.2',
      activeSessionID: 'session-123',
      fileInfos: {},
      messages: {
        'session-123': [
          {
            role: 'assistant',
            cost: 0.05,
            tokens: {
              input: 1000,
              output: 500,
              reasoning: 200,
              cache: { read: 100, write: 50 },
            },
            providerID: 'openai',
            modelID: 'gpt-4',
          },
        ],
      },
    };
    return selector(state);
  }),
}));

import type { Part } from '@opencode-ai/sdk/v2/client';

const mockOnSubmit = vi.fn<(text: string, parts: Part[]) => void>();
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
    textarea.textContent = 'Hello world';
    fireEvent.input(textarea);
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
    textarea.textContent = '';
    fireEvent.input(textarea);

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
    expect(sendBtn).toHaveAttribute('aria-label', 'Send');
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
    expect(stopBtn).toHaveAttribute('aria-label', 'Stop');
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

  /** Regression: respects controlled activeModel and activeAgent props. */
  it('regression: respects controlled activeModel and activeAgent props', () => {
    render(
      <PromptInput
        onSubmit={mockOnSubmit}
        models={[
          { id: 'model-1', name: 'Model 1' },
          { id: 'model-2', name: 'Model 2' },
        ]}
        agents={[
          { id: 'plan', name: 'Plan Agent' },
          { id: 'build', name: 'Build Agent' },
        ]}
        activeModel="model-2"
        activeAgent="build"
        onModelChange={mockOnModelChange}
        onAgentChange={mockOnAgentChange}
      />,
    );

    expect(screen.getByRole('combobox', { name: /select model/i })).toHaveTextContent('Model 2');
    expect(screen.getByRole('combobox', { name: /select agent/i })).toHaveTextContent(
      'Build Agent',
    );
  });

  /** Regression: footer row displays Workspace, LSP count, MCP count, Skills, extension version, context percentage, and cumulative cost. */
  it('regression: status footer row renders correct Workspace, LSP, MCP, Skills, version, context tokens, and cost', () => {
    render(
      <PromptInput
        onSubmit={mockOnSubmit}
        models={[{ id: 'openai/gpt-4', name: 'GPT-4', contextLimit: 100000 }]}
        agents={[{ id: 'agent-1', name: 'Agent 1' }]}
        onModelChange={mockOnModelChange}
        onAgentChange={mockOnAgentChange}
      />,
    );

    // Verify footer items are present in the DOM
    expect(screen.getByTestId('footer-workspace')).toHaveTextContent('TestWorkspace');
    expect(screen.getByTestId('footer-lsp')).toHaveTextContent('LSP: 1');
    expect(screen.getByTestId('footer-mcp')).toHaveTextContent('MCP: 1');
    expect(screen.getByTestId('footer-skills')).toHaveTextContent('Skills: 1');
    expect(screen.getByTestId('footer-version')).toHaveTextContent('v0.1.2');

    // Context Total: 1000 + 500 + 200 + 100 + 50 = 1850. Limit: 100000. Usage: Math.round(1850 / 100000 * 100) = 2%
    expect(screen.getByTestId('footer-context')).toHaveTextContent('1,850 / 100,000 (2%)');
    // Total Cost: 0.05
    expect(screen.getByTestId('footer-cost')).toHaveTextContent('$0.050');
  });

  it('regression: handles paste events for image files, multiline texts, and file paths', () => {
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

    // Test Multiline text paste:
    const multilinePasteEvent = {
      clipboardData: {
        files: [],
        getData: (format: string) => (format === 'text/plain' ? 'line 1\nline 2' : ''),
      },
      preventDefault: vi.fn(),
    };
    fireEvent.paste(textarea, multilinePasteEvent);
    expect(screen.getByText('Pasted 2 Lines')).toBeInTheDocument();

    // Test File path paste:
    const pathPasteEvent = {
      clipboardData: {
        files: [],
        getData: (format: string) => (format === 'text/plain' ? '/absolute/path/file.txt' : ''),
      },
      preventDefault: vi.fn(),
    };
    fireEvent.paste(textarea, pathPasteEvent);
    expect(screen.getByText('file.txt')).toBeInTheDocument();
  });

  it('regression: serializes inline chips to placeholders and correct Part payloads on submit', () => {
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

    // Paste multiline text snippet -> registers as a text chip
    const textPasteEvent = {
      clipboardData: {
        files: [],
        getData: (format: string) => (format === 'text/plain' ? 'some pasted code\nline 2' : ''),
      },
      preventDefault: vi.fn(),
    };
    fireEvent.paste(textarea, textPasteEvent);

    // Set text around the chip
    textarea.insertBefore(document.createTextNode('Prefix '), textarea.firstChild);
    textarea.appendChild(document.createTextNode('Suffix'));

    // Trigger input to update hasContent
    fireEvent.input(textarea);

    // Click submit
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(mockOnSubmit).toHaveBeenCalled();
    const [submittedText, submittedParts] = mockOnSubmit.mock.calls[0];

    expect(submittedText).toContain('Prefix [Text: Pasted 2 Lines] Suffix');
    expect(submittedParts.length).toBe(2);
    expect(submittedParts[0].type).toBe('text');
    const firstPart = submittedParts[0] as { type: 'text'; text: string };
    expect(firstPart.text).toBe('Prefix [Text: Pasted 2 Lines] Suffix');

    expect(submittedParts[1].type).toBe('text');
    const secondPart = submittedParts[1] as {
      type: 'text';
      text: string;
      metadata?: { type: string };
    };
    expect(secondPart.text).toBe('some pasted code\nline 2');
    expect(secondPart.metadata?.type).toBe('pasted-text');
  });

  it('regression: serialization of file chips without paths converts to data: URLs', () => {
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

    // Paste file contents without a path
    const filePasteEvent = {
      clipboardData: {
        files: [
          {
            name: 'CHANGELOG.md',
            size: 100,
            type: 'text/markdown',
          },
        ],
        getData: () => '',
      },
      preventDefault: vi.fn(),
    };

    // Mock FileReader behavior
    const mockFileReader = {
      onload: () => {},
      readAsText: vi.fn(function (this: { onload: () => void }) {
        this.onload();
      }),
      result: '# Changelog\nSome content',
    };
    vi.stubGlobal(
      'FileReader',
      vi.fn(() => mockFileReader),
    );

    fireEvent.paste(textarea, filePasteEvent);

    // Trigger input to update hasContent
    fireEvent.input(textarea);

    // Click submit
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(mockOnSubmit).toHaveBeenCalled();
    const [submittedText, submittedParts] = mockOnSubmit.mock.calls[0];

    expect(submittedText).toContain('[File: CHANGELOG.md]');
    expect(submittedParts.length).toBe(2);
    expect(submittedParts[1].type).toBe('file');
    const filePart = submittedParts[1] as { type: 'file'; url: string; filename: string };
    expect(filePart.filename).toBe('CHANGELOG.md');
    expect(filePart.url).toContain('data:text/plain;base64,');

    vi.unstubAllGlobals();
  });

  it('regression: pasting a file path retains the path and formats correctly', () => {
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

    const pathPasteEvent = {
      clipboardData: {
        files: [],
        getData: (format: string) =>
          format === 'text/plain' ? '/home/user/workspace/CHANGELOG.md' : '',
      },
      preventDefault: vi.fn(),
    };

    fireEvent.paste(textarea, pathPasteEvent);
    fireEvent.input(textarea);

    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(mockOnSubmit).toHaveBeenCalled();
    const [submittedText, submittedParts] = mockOnSubmit.mock.calls[0];

    expect(submittedText).toContain('[File: CHANGELOG.md]');
    expect(submittedParts.length).toBe(2);
    expect(submittedParts[1].type).toBe('file');
    const filePart = submittedParts[1] as { type: 'file'; url: string; filename: string };
    expect(filePart.filename).toBe('CHANGELOG.md');
    expect(filePart.url).toBe('file:///home/user/workspace/CHANGELOG.md');
  });

  it('regression: inserting a chip focuses editor and sets selection correctly', () => {
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

    // Spy on focus
    const focusSpy = vi.spyOn(textarea, 'focus');

    // Paste multiline text snippet -> triggers insertChip
    const textPasteEvent = {
      clipboardData: {
        files: [],
        getData: (format: string) => (format === 'text/plain' ? 'line 1\nline 2' : ''),
      },
      preventDefault: vi.fn(),
    };
    fireEvent.paste(textarea, textPasteEvent);

    expect(focusSpy).toHaveBeenCalled();
  });

  /** Regression: insertChip constructs DOM elements safely to prevent XSS from filenames. */
  it('regression: insertChip constructs DOM elements safely to prevent XSS from filenames', () => {
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

    // Paste file with potentially dangerous name/metadata to trigger XSS if innerHTML was used
    const dangerousName = '<img src=x onerror="window.xss=true">';
    const pathPasteEvent = {
      clipboardData: {
        files: [],
        getData: (format: string) =>
          format === 'text/plain' ? `/home/user/workspace/${dangerousName}` : '',
      },
      preventDefault: vi.fn(),
    };

    fireEvent.paste(textarea, pathPasteEvent);

    // Verify that the DOM does not contain an img element with onerror attribute
    const imgElement = textarea.querySelector('img[onerror]');
    expect(imgElement).toBeNull();

    // Verify that the label text is exactly the dangerous name
    const chipLabel = textarea.querySelector('.chip-label');
    expect(chipLabel).toBeInTheDocument();
    expect(chipLabel?.textContent).toBe(dangerousName);
  });
});
