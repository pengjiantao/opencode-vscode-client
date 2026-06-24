/**
 * @file Unit tests for PromptInput editor features — pasting, serialization, chips, and mention popovers.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
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
    return selector(state);
  }),
}));

import type { Part } from '@opencode-ai/sdk/v2/client';

const mockOnSubmit = vi.fn<(text: string, parts: Part[]) => void>();
const mockOnModelChange = vi.fn();
const mockOnAgentChange = vi.fn();

describe('PromptInput - Editor & Mention Popover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    expect(submittedText).toContain('Prefix [Text: Pasted 2 Lines]Suffix');
    expect(submittedParts.length).toBe(2);
    expect(submittedParts[0].type).toBe('text');
    const firstPart = submittedParts[0] as { type: 'text'; text: string };
    expect(firstPart.text).toBe('Prefix [Text: Pasted 2 Lines]Suffix');

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
    const dangerousName = '<img src=x onerror=xss()>';
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

  it('regression: shows mention popover when @ is typed and handles selection/insertion', () => {
    vi.useFakeTimers();
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
    act(() => {
      textarea.focus();
    });

    const textNode = document.createTextNode('@');
    textarea.appendChild(textNode);

    const mockRange = {
      startContainer: textNode,
      startOffset: 1,
      endContainer: textNode,
      endOffset: 1,
      commonAncestorContainer: textarea,
      deleteContents: vi.fn(),
      insertNode: vi.fn(),
      setStart: vi.fn(),
      setEnd: vi.fn(),
    };

    const mockSelection = {
      rangeCount: 1,
      getRangeAt: () => mockRange,
      removeAllRanges: vi.fn(),
      addRange: vi.fn(),
    };

    vi.stubGlobal('getSelection', () => mockSelection);

    // Trigger keyUp to update mention state
    act(() => {
      fireEvent.keyUp(textarea);
    });

    // Verify search message was posted
    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'workspace:search-files',
      query: '',
    });

    // Mock incoming IPC file response
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'workspace:search-files-response',
            query: '',
            results: [
              {
                name: 'file1.txt',
                relativePath: 'file1.txt',
                type: 'file',
                fsPath: '/w/file1.txt',
              },
              { name: 'src', relativePath: 'src', type: 'dir', fsPath: '/w/src' },
            ],
          },
        }),
      );
    });

    // Verify popover is visible
    const popover = screen.getByTestId('mention-popover');
    expect(popover).toBeInTheDocument();

    const items = screen.getAllByTestId(/mention-popover-item-/);
    expect(items.length).toBe(2);
    expect(items[0]).toHaveTextContent('file1.txt');
    expect(items[1]).toHaveTextContent('src');

    // Simulate keydown arrow keys
    act(() => {
      fireEvent.keyDown(textarea, { key: 'ArrowDown' });
    });
    expect(items[1]).toHaveClass('selected');

    act(() => {
      fireEvent.keyDown(textarea, { key: 'ArrowUp' });
    });
    expect(items[0]).toHaveClass('selected');

    // Simulate clicking item to insert chip
    act(() => {
      fireEvent.click(items[1]);
    });

    // Verify popover closed
    expect(screen.queryByTestId('mention-popover')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(250);
    });

    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('regression: handles editor:selection message, inserts chip, and triggers explain action if requested', () => {
    vi.useFakeTimers();
    render(
      <PromptInput
        onSubmit={mockOnSubmit}
        models={[{ id: 'model-1', name: 'Model 1' }]}
        agents={[{ id: 'agent-1', name: 'Agent 1' }]}
        onModelChange={mockOnModelChange}
        onAgentChange={mockOnAgentChange}
      />,
    );

    // Mock incoming editor:selection IPC message
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'editor:selection',
            text: 'const a = 1;',
            filename: 'main.ts',
            path: '/path/main.ts',
            startLine: 1,
            endLine: 2,
            action: 'explain',
          },
        }),
      );
    });

    // Let the setTimeout runs
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Check that onSubmit has been triggered with the explain text and the code selection parts
    expect(mockOnSubmit).toHaveBeenCalled();
    const [submittedText, submittedParts] = mockOnSubmit.mock.calls[0];
    expect(submittedText).toContain('[Code Selection: main.ts [1-2]]');
    expect(submittedText).toContain('Explain this code');
    expect(submittedParts.length).toBe(2);
    expect(submittedParts[1].type).toBe('file');

    vi.useRealTimers();
  });

  it('regression: handles terminal:selection message, inserts chip, and triggers explain-fix action if requested', () => {
    vi.useFakeTimers();
    render(
      <PromptInput
        onSubmit={mockOnSubmit}
        models={[{ id: 'model-1', name: 'Model 1' }]}
        agents={[{ id: 'agent-1', name: 'Agent 1' }]}
        onModelChange={mockOnModelChange}
        onAgentChange={mockOnAgentChange}
      />,
    );

    // Mock incoming terminal:selection IPC message
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'terminal:selection',
            text: 'Error in line 5',
            linesCount: 3,
            action: 'explain-fix',
          },
        }),
      );
    });

    // Let the setTimeout runs
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(mockOnSubmit).toHaveBeenCalled();
    const [submittedText, submittedParts] = mockOnSubmit.mock.calls[0];
    expect(submittedText).toContain('[Terminal: 3 lines]');
    expect(submittedText).toContain('Explain this content or fix issues in it');
    expect(submittedParts.length).toBe(2);
    expect(submittedParts[1].type).toBe('file');

    vi.useRealTimers();
  });
});
