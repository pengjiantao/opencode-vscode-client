/**
 * @file Unit tests for usePromptEditor.ts.
 * Verifies insertion of file, image, and text chips, and paste event handlers.
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { WebviewToExt } from '../../shared/types';
import { usePromptEditor } from './usePromptEditor';

// Mock clipboard data for testing paste events
class MockClipboardData {
  items: DataTransferItem[] = [];
  files: File[] = [];

  constructor(
    private text: string = '',
    files: File[] = [],
  ) {
    this.files = files;
  }

  getData(format: string) {
    if (format === 'text/plain') return this.text;
    return '';
  }
}

interface TestCompProps {
  fileInfos: Record<
    string,
    { exists: boolean; size: number; content?: string; isWorkspace: boolean }
  >;
  sendSpy: (msg: WebviewToExt) => void;
  onInputSpy: () => void;
}

const TestComponent: React.FC<TestCompProps> = ({ fileInfos, sendSpy, onInputSpy }) => {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const { insertChip, handlePaste } = usePromptEditor({
    editorRef,
    fileInfos,
    send: sendSpy,
    onInput: onInputSpy,
  });

  return (
    <div>
      <div
        ref={editorRef}
        data-testid="editor"
        contentEditable
        onPaste={handlePaste}
        style={{ width: '100%', height: '100px', border: '1px solid black' }}
      />
      <button
        data-testid="btn-insert-file"
        onClick={() =>
          insertChip({
            id: 'file-123',
            type: 'file',
            filename: 'test-file.ts',
            path: 'src/test-file.ts',
            size: 2048,
            mime: 'text/typescript',
            isWorkspace: true,
          })
        }
      >
        Insert File Chip
      </button>
      <button
        data-testid="btn-insert-text"
        onClick={() =>
          insertChip({
            id: 'text-123',
            type: 'text',
            filename: 'Pasted 3 Lines',
            text: 'line1\nline2\nline3',
            linesCount: 3,
          })
        }
      >
        Insert Text Chip
      </button>
    </div>
  );
};

describe('usePromptEditor', () => {
  it('should insert a file chip correctly and call the send and onInput callbacks', () => {
    const sendSpy = vi.fn();
    const onInputSpy = vi.fn();
    render(<TestComponent fileInfos={{}} sendSpy={sendSpy} onInputSpy={onInputSpy} />);

    const editor = screen.getByTestId('editor');
    expect(editor.children.length).toBe(0);

    const button = screen.getByTestId('btn-insert-file');
    fireEvent.click(button);

    // Should render the chip elements
    const chip = editor.querySelector('.opencode-chip.file-chip');
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveAttribute('data-chip-id', 'file-123');
    expect(chip).toHaveAttribute('data-chip-type', 'file');
    expect(chip).toHaveAttribute('data-chip-path', 'src/test-file.ts');
    expect(chip).toHaveAttribute('data-chip-filename', 'test-file.ts');
    expect(chip).toHaveAttribute('data-chip-is-workspace', 'true');

    // Should display the filename
    expect(screen.getByText('test-file.ts')).toBeInTheDocument();

    // Should call file:query via send
    expect(sendSpy).toHaveBeenCalledWith({
      type: 'file:query',
      path: 'src/test-file.ts',
    });

    // Should trigger onInput
    expect(onInputSpy).toHaveBeenCalled();
  });

  it('should insert a text chip correctly', () => {
    const sendSpy = vi.fn();
    const onInputSpy = vi.fn();
    render(<TestComponent fileInfos={{}} sendSpy={sendSpy} onInputSpy={onInputSpy} />);

    const editor = screen.getByTestId('editor');
    const button = screen.getByTestId('btn-insert-text');
    fireEvent.click(button);

    const chip = editor.querySelector('.opencode-chip.text-chip');
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveAttribute('data-chip-id', 'text-123');
    expect(chip).toHaveAttribute('data-chip-type', 'text');
    expect(chip).toHaveAttribute('data-chip-text', 'line1\nline2\nline3');
    expect(chip).toHaveAttribute('data-chip-lines-count', '3');

    expect(screen.getByText('Pasted 3 Lines')).toBeInTheDocument();
  });

  it('should insert chip and place cursor after it without trailing space', () => {
    const sendSpy = vi.fn();
    const onInputSpy = vi.fn();
    render(<TestComponent fileInfos={{}} sendSpy={sendSpy} onInputSpy={onInputSpy} />);

    const editor = screen.getByTestId('editor');
    const button = screen.getByTestId('btn-insert-file');
    fireEvent.click(button);

    // Verify no text nodes containing spaces are siblings of the chip
    const spaceNode = Array.from(editor.childNodes).find(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent === ' ',
    );
    expect(spaceNode).toBeUndefined();
  });

  it('should parse pasted file paths and insert them as chips', () => {
    const sendSpy = vi.fn();
    render(<TestComponent fileInfos={{}} sendSpy={sendSpy} onInputSpy={vi.fn()} />);

    const editor = screen.getByTestId('editor');

    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: new MockClipboardData('/home/workspace/package.json'),
    });

    fireEvent(editor, pasteEvent);

    const chip = editor.querySelector('.opencode-chip.file-chip');
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveAttribute('data-chip-path', '/home/workspace/package.json');
    expect(chip).toHaveAttribute('data-chip-filename', 'package.json');
  });

  it('should parse pasted multiline text and insert it as a text chip', () => {
    render(<TestComponent fileInfos={{}} sendSpy={vi.fn()} onInputSpy={vi.fn()} />);

    const editor = screen.getByTestId('editor');

    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: new MockClipboardData('first line\nsecond line\nthird line'),
    });

    fireEvent(editor, pasteEvent);

    const chip = editor.querySelector('.opencode-chip.text-chip');
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveAttribute('data-chip-text', 'first line\nsecond line\nthird line');
    expect(chip).toHaveAttribute('data-chip-lines-count', '3');
    expect(screen.getByText('Pasted 3 Lines')).toBeInTheDocument();
  });

  it('should parse pasted single-line plain text and insert it as plain text', () => {
    const onInputSpy = vi.fn();
    render(<TestComponent fileInfos={{}} sendSpy={vi.fn()} onInputSpy={onInputSpy} />);

    const editor = screen.getByTestId('editor');

    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: new MockClipboardData('hello world'),
    });

    fireEvent(editor, pasteEvent);

    expect(editor.textContent).toBe('hello world');
    expect(onInputSpy).toHaveBeenCalled();
  });

  it('regression: should not parse multiline code block comments starting with // as file paths', () => {
    const sendSpy = vi.fn();
    render(<TestComponent fileInfos={{}} sendSpy={sendSpy} onInputSpy={vi.fn()} />);

    const editor = screen.getByTestId('editor');

    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: new MockClipboardData(
        "// ── 路径 A：转发到 webview PermissionCard ──\nipc.send({ type: 'event:received', event } as ExtToWebview);",
      ),
    });

    fireEvent(editor, pasteEvent);

    // It should NOT insert a file chip
    const fileChip = editor.querySelector('.opencode-chip.file-chip');
    expect(fileChip).not.toBeInTheDocument();

    // It should insert it as a text chip (since it is multiline text)
    const textChip = editor.querySelector('.opencode-chip.text-chip');
    expect(textChip).toBeInTheDocument();
    expect(textChip).toHaveAttribute(
      'data-chip-text',
      "// ── 路径 A：转发到 webview PermissionCard ──\nipc.send({ type: 'event:received', event } as ExtToWebview);",
    );
  });

  it('regression: should not parse single-line comments starting with // as file paths', () => {
    const sendSpy = vi.fn();
    render(<TestComponent fileInfos={{}} sendSpy={sendSpy} onInputSpy={vi.fn()} />);

    const editor = screen.getByTestId('editor');

    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: new MockClipboardData('// ── 路径 A ──'),
    });

    fireEvent(editor, pasteEvent);

    // It should NOT insert a file chip
    const fileChip = editor.querySelector('.opencode-chip.file-chip');
    expect(fileChip).not.toBeInTheDocument();

    // It should insert it as plain text in the editor
    expect(editor.textContent).toBe('// ── 路径 A ──');
  });

  it('regression: should not parse slash commands as file paths', () => {
    const sendSpy = vi.fn();
    render(<TestComponent fileInfos={{}} sendSpy={sendSpy} onInputSpy={vi.fn()} />);

    const editor = screen.getByTestId('editor');

    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: new MockClipboardData('/goal'),
    });

    fireEvent(editor, pasteEvent);

    // It should NOT insert a file chip
    const fileChip = editor.querySelector('.opencode-chip.file-chip');
    expect(fileChip).not.toBeInTheDocument();

    // It should insert it as plain text
    expect(editor.textContent).toBe('/goal');
  });
});
