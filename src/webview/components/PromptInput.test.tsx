/**
 * @file Unit tests for PromptInput — submission, empty validation, dropdowns, and regression tests.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PromptInput } from './PromptInput';
import { PromptInputHeader } from './PromptInputHeader';

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

const defaultMockState = {
  workspaceName: 'TestWorkspace',
  lspServers: [{ name: 'typescript-lsp', status: 'running' }],
  mcpServers: [{ name: 'git-mcp', status: 'connected' }],
  skills: [{ name: 'customize-opencode', description: 'desc' }],
  commands: [],
  plugins: ['plugin-1'],
  extensionVersion: '0.1.2',
  publisher: 'fiyqkrc',
  opencodeVersion: '1.0.0',
  activeSessionID: 'session-123',
  fileInfos: {},
  sessionDiffs: {},
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

vi.mock('../store/sessionStore', () => ({
  useSessionStore: vi.fn(),
}));

import type { Part } from '@opencode-ai/sdk/v2/client';
import { SessionStore, useSessionStore } from '../store/sessionStore';

const mockOnSubmit = vi.fn<(text: string, parts: Part[]) => void>();
const mockOnModelChange = vi.fn();
const mockOnAgentChange = vi.fn();

describe('PromptInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSessionStore).mockImplementation(<T,>(selector: (state: SessionStore) => T): T => {
      return selector(defaultMockState as unknown as SessionStore);
    });
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

  /** Regression: stop button has stop-btn class to map to high-contrast errorForeground colors. */
  it('regression: stop button has stop-btn class to map to errorForeground colors', () => {
    render(
      <PromptInput
        onSubmit={mockOnSubmit}
        status={{ type: 'busy' }}
        models={[]}
        agents={[]}
        onModelChange={mockOnModelChange}
        onAgentChange={mockOnAgentChange}
      />,
    );

    const stopBtn = screen.getByRole('button', { name: /stop/i });
    expect(stopBtn).toHaveClass('stop-btn');
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

  /** Regression: models within the same provider group are sorted alphabetically (case-insensitive). */
  it('regression: models are sorted alphabetically within each provider group', () => {
    const models = [
      { id: 'm1', name: 'GPT-4o', providerName: 'OpenAI', isConnected: true },
      { id: 'm2', name: 'Claude', providerName: 'Anthropic', isConnected: true },
      { id: 'm3', name: 'gpt-3.5-turbo', providerName: 'OpenAI', isConnected: true },
      { id: 'm4', name: 'claude-3-opus', providerName: 'Anthropic', isConnected: true },
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

    const allOptions = screen.getAllByRole('option');
    const optionNames = allOptions.map((el) => el.textContent?.replace('✓', '').trim());

    // Within Anthropic: Claude and claude-3-opus are sorted case-insensitively
    // Within OpenAI: gpt-3.5-turbo comes before GPT-4o
    expect(optionNames).toEqual(['Claude', 'claude-3-opus', 'gpt-3.5-turbo', 'GPT-4o']);
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

  /** Regression: status elements render correctly, split between header and footer rows. */
  it('regression: status header and footer rows render correct Workspace, LSP, MCP, Skills, version, context tokens, and cost', () => {
    render(
      <PromptInput
        onSubmit={mockOnSubmit}
        models={[{ id: 'openai/gpt-4', name: 'GPT-4', contextLimit: 100000 }]}
        agents={[{ id: 'agent-1', name: 'Agent 1' }]}
        onModelChange={mockOnModelChange}
        onAgentChange={mockOnAgentChange}
      />,
    );

    // Verify footer and header items are present in the DOM
    expect(screen.getByTestId('footer-workspace')).toHaveTextContent('TestWorkspace');
    expect(screen.getByTestId('header-lsp')).toHaveTextContent('LSP: 1');
    expect(screen.getByTestId('header-mcp')).toHaveTextContent('MCP: 1');
    expect(screen.getByTestId('header-skills')).toHaveTextContent('Skills: 1');
    expect(screen.getByTestId('header-version')).toHaveTextContent('v0.1.2');

    // Context Total: 1000 + 500 + 200 + 100 + 50 = 1850. Limit: 100000. Usage: Math.round(1850 / 100000 * 100) = 2%
    expect(screen.getByTestId('footer-context')).toHaveTextContent('1,850 / 100,000 (2%)');
    // Total Cost: 0.05
    expect(screen.getByTestId('footer-cost')).toHaveTextContent('$0.050');
  });

  /** Regression: the metrics tooltip cost value must inherit tooltip foreground for light themes. */
  it('regression: metrics tooltip cost does not use status bar warning foreground color', () => {
    render(
      <PromptInput
        onSubmit={mockOnSubmit}
        models={[{ id: 'openai/gpt-4', name: 'GPT-4', contextLimit: 100000 }]}
        agents={[{ id: 'agent-1', name: 'Agent 1' }]}
        onModelChange={mockOnModelChange}
        onAgentChange={mockOnAgentChange}
      />,
    );

    const tooltip = screen.getByTestId('footer-cost').getAttribute('data-custom-title') || '';

    expect(tooltip).toContain('Cumulative Cost:');
    expect(tooltip).toContain('$0.0500');
    expect(tooltip).not.toContain('--vscode-statusBarItem-warningForeground');
    expect(tooltip).not.toContain('#e2c08d');
  });

  /** Regression: footer token and cost statistics are always rendered, showing initial/fallback states correctly. */
  it('regression: footer token and cost statistics are always rendered, showing initial/fallback states correctly', () => {
    // 1. Test new session (no messages)
    vi.mocked(useSessionStore).mockImplementation(<T,>(selector: (state: SessionStore) => T): T => {
      const state = {
        workspaceName: 'TestWorkspace',
        lspServers: [],
        mcpServers: [],
        skills: [],
        commands: [],
        plugins: [],
        extensionVersion: '0.1.2',
        publisher: 'fiyqkrc',
        opencodeVersion: '1.0.0',
        activeSessionID: 'session-123',
        fileInfos: {},
        sessionDiffs: {},
        messages: {
          'session-123': [],
        },
      };
      return selector(state as unknown as SessionStore);
    });

    const { rerender } = render(
      <PromptInput
        onSubmit={mockOnSubmit}
        models={[{ id: 'openai/gpt-4', name: 'GPT-4', contextLimit: 100000 }]}
        agents={[{ id: 'agent-1', name: 'Agent 1' }]}
        onModelChange={mockOnModelChange}
        onAgentChange={mockOnAgentChange}
      />,
    );

    // Context tokens should show initial 0 state, cost should show $0.000
    expect(screen.getByTestId('footer-context')).toHaveTextContent('0 / 100,000 (0%)');
    expect(screen.getByTestId('footer-cost')).toHaveTextContent('$0.000');

    // 2. Test message sent but first assistant step not finished
    vi.mocked(useSessionStore).mockImplementation(<T,>(selector: (state: SessionStore) => T): T => {
      const state = {
        workspaceName: 'TestWorkspace',
        lspServers: [],
        mcpServers: [],
        skills: [],
        commands: [],
        plugins: [],
        extensionVersion: '0.1.2',
        publisher: 'fiyqkrc',
        opencodeVersion: '1.0.0',
        activeSessionID: 'session-123',
        fileInfos: {},
        sessionDiffs: {},
        messages: {
          'session-123': [
            {
              role: 'user',
              content: 'hello',
            },
            {
              role: 'assistant',
              cost: 0,
              tokens: {
                input: 1000,
                output: 0,
                reasoning: 0,
                cache: { read: 0, write: 0 },
              },
              providerID: 'openai',
              modelID: 'gpt-4',
            },
          ],
        },
      };
      return selector(state as unknown as SessionStore);
    });

    rerender(
      <PromptInput
        onSubmit={mockOnSubmit}
        models={[{ id: 'openai/gpt-4', name: 'GPT-4', contextLimit: 100000 }]}
        agents={[{ id: 'agent-1', name: 'Agent 1' }]}
        onModelChange={mockOnModelChange}
        onAgentChange={mockOnAgentChange}
      />,
    );

    // Context tokens should render 0 / 100,000 (0%) and cost should show $0.000
    expect(screen.getByTestId('footer-context')).toHaveTextContent('0 / 100,000 (0%)');
    expect(screen.getByTestId('footer-cost')).toHaveTextContent('$0.000');
  });

  /** Regression: workspace name container has correct DOM structure and classes to prevent visual overlapping. */
  it('regression: workspace metadata item has correct CSS classes and structure to prevent layout overlap', () => {
    render(
      <PromptInput
        onSubmit={mockOnSubmit}
        models={[]}
        agents={[]}
        onModelChange={mockOnModelChange}
        onAgentChange={mockOnAgentChange}
      />,
    );

    const workspaceItem = screen.getByTestId('footer-workspace');
    expect(workspaceItem).toHaveClass('metadata-item', 'workspace');

    const textSpan = workspaceItem.querySelector('span:not(.codicon)');
    expect(textSpan).toBeInTheDocument();
    expect(textSpan).toHaveTextContent('TestWorkspace');
  });

  /**
   * Regression: Verify sub-footer containers and folder icon have layout classes preventing
   * overlaps (flex-shrink: 0 on metadata-icon and sub-footer-right) and early truncation
   * (flex: 1 on sub-footer-left).
   */
  it('regression: sub-footer elements have layout classes preventing overlap and early truncation', () => {
    const { container } = render(
      <PromptInput
        onSubmit={mockOnSubmit}
        models={[]}
        agents={[]}
        onModelChange={mockOnModelChange}
        onAgentChange={mockOnAgentChange}
      />,
    );

    // Verify sub-footer-left and sub-footer-right structural elements exist for flex spacing layout
    const leftFooter = container.querySelector('.sub-footer-left');
    const rightFooter = container.querySelector('.sub-footer-right');
    expect(leftFooter).toBeInTheDocument();
    expect(rightFooter).toBeInTheDocument();

    // Verify folder icon has metadata-icon class to guarantee flex-shrink: 0 applies to prevent icon overlap
    const workspaceItem = screen.getByTestId('footer-workspace');
    const icon = workspaceItem.querySelector('.codicon-folder');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass('metadata-icon');
  });

  /** Regression: clicks attach button and posts file:select message */
  it('regression: clicks attach button and posts file:select message', () => {
    render(
      <PromptInput
        onSubmit={mockOnSubmit}
        models={[]}
        agents={[]}
        onModelChange={mockOnModelChange}
        onAgentChange={mockOnAgentChange}
      />,
    );

    const attachBtn = screen.getByRole('button', { name: /add file reference/i });
    fireEvent.click(attachBtn);

    expect(window.vscode.postMessage).toHaveBeenCalledWith({ type: 'file:select' });
  });

  /** Regression: inserts chip when receiving file:selected message */
  it('regression: inserts chip when receiving file:selected message', () => {
    render(
      <PromptInput
        onSubmit={mockOnSubmit}
        models={[]}
        agents={[]}
        onModelChange={mockOnModelChange}
        onAgentChange={mockOnAgentChange}
      />,
    );

    const editor = screen.getByTestId('prompt-editor');

    // Simulate IPC message from extension host
    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: 'file:selected',
          files: [
            {
              name: 'test.txt',
              fsPath: '/workspace/test.txt',
              size: 100,
              mime: 'text/plain',
            },
          ],
        },
      }),
    );

    // Verify chip was inserted into editor
    const chip = editor.querySelector('.opencode-chip');
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveAttribute('data-chip-filename', 'test.txt');
    expect(chip).toHaveAttribute('data-chip-path', '/workspace/test.txt');
  });

  it('regression: inserts selected PDFs as Markdown absolute path references', () => {
    render(
      <PromptInput
        onSubmit={mockOnSubmit}
        models={[]}
        agents={[]}
        onModelChange={mockOnModelChange}
        onAgentChange={mockOnAgentChange}
      />,
    );

    const editor = screen.getByTestId('prompt-editor');

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: 'file:selected',
          files: [
            {
              name: 'statement.pdf',
              fsPath: '/workspace/docs/statement.pdf',
              size: 100,
              mime: 'application/pdf',
            },
          ],
        },
      }),
    );

    expect(editor.querySelector('.opencode-chip')).not.toBeInTheDocument();
    expect(editor.textContent).toBe('[statement.pdf](</workspace/docs/statement.pdf>)\n');

    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(mockOnSubmit).toHaveBeenCalledWith('[statement.pdf](</workspace/docs/statement.pdf>)', [
      expect.objectContaining({
        type: 'text',
        text: '[statement.pdf](</workspace/docs/statement.pdf>)',
      }),
    ]);
  });

  it('regression: inserts resolved clipboard file paths as Markdown absolute path references', () => {
    render(
      <PromptInput
        onSubmit={mockOnSubmit}
        models={[]}
        agents={[]}
        onModelChange={mockOnModelChange}
        onAgentChange={mockOnAgentChange}
      />,
    );

    const editor = screen.getByTestId('prompt-editor');

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: 'clipboard:file-paths-resolved',
          requestID: 'clipboard-paste-1',
          files: [
            {
              name: 'income-proof.docx',
              fsPath: '/home/user/Documents/income-proof.docx',
              size: 100,
              mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            },
          ],
          unresolved: [],
        },
      }),
    );

    expect(editor.querySelector('.opencode-chip')).not.toBeInTheDocument();
    expect(editor.textContent).toBe(
      '[income-proof.docx](</home/user/Documents/income-proof.docx>)\n',
    );
  });

  it('regression: inserts selected VSIX files as Markdown absolute path references', () => {
    render(
      <PromptInput
        onSubmit={mockOnSubmit}
        models={[]}
        agents={[]}
        onModelChange={mockOnModelChange}
        onAgentChange={mockOnAgentChange}
      />,
    );

    const editor = screen.getByTestId('prompt-editor');

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: 'file:selected',
          files: [
            {
              name: 'extension.vsix',
              fsPath: '/workspace/dist/extension.vsix',
              size: 100,
              mime: 'text/plain',
            },
          ],
        },
      }),
    );

    expect(editor.querySelector('.opencode-chip')).not.toBeInTheDocument();
    expect(editor.textContent).toBe('[extension.vsix](</workspace/dist/extension.vsix>)\n');
  });

  it('regression: inserts selected extensionless files as Markdown absolute path references', () => {
    render(
      <PromptInput
        onSubmit={mockOnSubmit}
        models={[]}
        agents={[]}
        onModelChange={mockOnModelChange}
        onAgentChange={mockOnAgentChange}
      />,
    );

    const editor = screen.getByTestId('prompt-editor');

    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: 'file:selected',
          files: [
            {
              name: 'opencode',
              fsPath: '/usr/local/bin/opencode',
              size: 100,
              mime: 'text/plain',
            },
          ],
        },
      }),
    );

    expect(editor.querySelector('.opencode-chip')).not.toBeInTheDocument();
    expect(editor.textContent).toBe('[opencode](</usr/local/bin/opencode>)\n');
  });

  /** Regression: inserts plain text when receiving editor:paste-plain-text message */
  it('regression: inserts plain text when receiving editor:paste-plain-text message', () => {
    render(
      <PromptInput
        onSubmit={mockOnSubmit}
        models={[]}
        agents={[]}
        onModelChange={mockOnModelChange}
        onAgentChange={mockOnAgentChange}
      />,
    );

    const editor = screen.getByTestId('prompt-editor');

    // Simulate IPC message from extension host
    fireEvent(
      window,
      new MessageEvent('message', {
        data: {
          type: 'editor:paste-plain-text',
          text: 'hello from clipboard',
        },
      }),
    );

    // Verify plain text was inserted into editor
    expect(editor.textContent).toBe('hello from clipboard');
  });

  /** Regression: VariantSelector is rendered only when active model has variants. */
  it('regression: VariantSelector is rendered only when active model has variants', () => {
    const models = [
      {
        id: 'model-with-variants',
        name: 'Model V',
        providerName: 'OpenAI',
        isConnected: true,
        variants: ['low', 'high'],
      },
      { id: 'model-no-variants', name: 'Model N', providerName: 'OpenAI', isConnected: true },
    ];
    const mockOnVariantChange = vi.fn();
    const { rerender } = render(
      <PromptInput
        onSubmit={mockOnSubmit}
        models={models}
        agents={[]}
        activeModel="model-no-variants"
        onModelChange={mockOnModelChange}
        onAgentChange={mockOnAgentChange}
        onVariantChange={mockOnVariantChange}
      />,
    );

    expect(screen.queryByRole('combobox', { name: /select model variant/i })).toBeNull();

    rerender(
      <PromptInput
        onSubmit={mockOnSubmit}
        models={models}
        agents={[]}
        activeModel="model-with-variants"
        onModelChange={mockOnModelChange}
        onAgentChange={mockOnAgentChange}
        onVariantChange={mockOnVariantChange}
      />,
    );

    const variantTrigger = screen.getByRole('combobox', { name: /select model variant/i });
    expect(variantTrigger).toBeInTheDocument();
    expect(variantTrigger).toHaveTextContent('Default');

    fireEvent.click(variantTrigger);
    const option = screen.getByText('high');
    fireEvent.click(option);
    expect(mockOnVariantChange).toHaveBeenCalledWith('model-with-variants', 'high');
  });
});

describe('PromptInputHeader', () => {
  it('renders correctly with custom props and uses CSS theme variables for tooltip styling', () => {
    const lspServers = [{ name: 'python-lsp', status: 'running' }];
    const mcpServers = [{ name: 'postgres-mcp', status: 'failed', error: 'Port bind error' }];
    const skills = [
      { name: 'git-expert', description: 'Advanced git skill', location: '/skills/git' },
    ];
    const extensionVersion = '1.0.4';

    render(
      <PromptInputHeader
        lspServers={lspServers}
        mcpServers={mcpServers}
        skills={skills}
        extensionVersion={extensionVersion}
      />,
    );

    // Verify header status elements render custom props values correctly
    const lspEl = screen.getByTestId('header-lsp');
    const mcpEl = screen.getByTestId('header-mcp');
    const skillsEl = screen.getByTestId('header-skills');
    const versionEl = screen.getByTestId('header-version');

    expect(lspEl).toHaveTextContent('LSP: 1');
    expect(mcpEl).toHaveTextContent('MCP: 1');
    expect(skillsEl).toHaveTextContent('Skills: 1');
    expect(versionEl).toHaveTextContent('v1.0.4');

    // Retrieve tooltips
    const lspTooltip = lspEl.getAttribute('data-custom-title') || '';
    const mcpTooltip = mcpEl.getAttribute('data-custom-title') || '';

    // Verify tooltip contents do not use hardcoded hex values (#89d185 / #cca700 / #f48771) for status colors
    expect(lspTooltip).not.toContain('#89d185');
    expect(lspTooltip).not.toContain('#cca700');
    expect(mcpTooltip).not.toContain('#f48771');

    // Verify they use standard VS Code theme variables instead
    expect(lspTooltip).toContain('var(--vscode-charts-green)');
    expect(mcpTooltip).toContain('var(--vscode-charts-red)');
    expect(mcpTooltip).toContain('Port bind error');
  });

  /**
   * Regression: the version tooltip must surface the real publisher id from
   * package.json and the opencode server version, instead of the hard-coded
   * "Google DeepMind" placeholder that previously existed in the tooltip.
   */
  it('regression: version tooltip shows real publisher and opencode version (no hard-coded DeepMind string)', () => {
    render(
      <PromptInputHeader extensionVersion="0.1.32" publisher="fiyqkrc" opencodeVersion="1.16.2" />,
    );

    const versionEl = screen.getByTestId('header-version');
    const tooltip = versionEl.getAttribute('data-custom-title') || '';

    // Real values coming from package.json + /global/health
    expect(tooltip).toContain('v0.1.32');
    expect(tooltip).toContain('fiyqkrc');
    expect(tooltip).toContain('v1.16.2');

    // The previous hard-coded placeholder must be gone
    expect(tooltip).not.toContain('Google DeepMind');
  });
});
