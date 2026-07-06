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
  private readonly dataByFormat: Record<string, string>;

  constructor(textOrData: string | Record<string, string> = '', files: File[] = []) {
    this.files = files;
    this.dataByFormat = typeof textOrData === 'string' ? { 'text/plain': textOrData } : textOrData;
  }

  getData(format: string) {
    return this.dataByFormat[format] ?? '';
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

  it('regression: should insert pasted PDFs as Markdown absolute path references', () => {
    const sendSpy = vi.fn();
    render(<TestComponent fileInfos={{}} sendSpy={sendSpy} onInputSpy={vi.fn()} />);

    const editor = screen.getByTestId('editor');
    const file = new File(['%PDF-1.4'], 'statement.pdf', { type: 'application/pdf' });
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: new MockClipboardData(
        {
          'text/plain': 'statement.pdf',
          'text/uri-list': 'file:///home/user/Documents/statement.pdf',
        },
        [file],
      ),
    });

    fireEvent(editor, pasteEvent);

    const chip = editor.querySelector('.opencode-chip.file-chip');
    expect(chip).not.toBeInTheDocument();
    expect(editor.textContent).toBe('[statement.pdf](</home/user/Documents/statement.pdf>)\n');
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('regression: should infer document MIME from pasted file paths when clipboard reports text/plain', () => {
    const sendSpy = vi.fn();
    render(<TestComponent fileInfos={{}} sendSpy={sendSpy} onInputSpy={vi.fn()} />);

    const editor = screen.getByTestId('editor');
    const file = new File(['PK'], 'income-proof.docx', { type: 'text/plain' });
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: new MockClipboardData(
        {
          'text/plain': 'income-proof.docx',
          'text/uri-list': 'file:///home/user/Documents/income-proof.docx',
        },
        [file],
      ),
    });

    fireEvent(editor, pasteEvent);

    expect(editor.querySelector('.opencode-chip.file-chip')).not.toBeInTheDocument();
    expect(editor.textContent).toBe(
      '[income-proof.docx](</home/user/Documents/income-proof.docx>)\n',
    );
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('regression: should parse GNOME copied file paths as Markdown references', () => {
    const sendSpy = vi.fn();
    render(<TestComponent fileInfos={{}} sendSpy={sendSpy} onInputSpy={vi.fn()} />);

    const editor = screen.getByTestId('editor');
    const file = new File(['%PDF-1.4'], 'statement.pdf', { type: 'application/pdf' });
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: new MockClipboardData(
        {
          'text/plain': 'statement.pdf',
          'x-special/gnome-copied-files': 'copy\nfile:///home/user/Documents/statement.pdf',
        },
        [file],
      ),
    });

    fireEvent(editor, pasteEvent);

    expect(editor.querySelector('.opencode-chip.file-chip')).not.toBeInTheDocument();
    expect(editor.textContent).toBe('[statement.pdf](</home/user/Documents/statement.pdf>)\n');
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('regression: should request absolute path resolution for non-text clipboard files without exposed paths', () => {
    const sendSpy = vi.fn<(msg: WebviewToExt) => void>();
    render(<TestComponent fileInfos={{}} sendSpy={sendSpy} onInputSpy={vi.fn()} />);

    const editor = screen.getByTestId('editor');
    const file = new File(['%PDF-1.4'], 'statement.pdf', { type: 'application/pdf' });
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: new MockClipboardData('', [file]),
    });

    fireEvent(editor, pasteEvent);

    expect(editor.querySelector('.opencode-chip.file-chip')).not.toBeInTheDocument();
    expect(editor.textContent).toBe('');
    expect(sendSpy).toHaveBeenCalledTimes(1);

    const message = sendSpy.mock.calls[0]?.[0];
    expect(message?.type).toBe('clipboard:resolve-file-paths');
    if (message?.type !== 'clipboard:resolve-file-paths') return;
    expect(message.requestID).toMatch(/^clipboard-paste-/);
    expect(message.files).toEqual([
      {
        name: 'statement.pdf',
        size: file.size,
        mime: 'application/pdf',
      },
    ]);
  });

  it('regression: should insert pasted VSIX files as Markdown absolute path references', () => {
    const sendSpy = vi.fn();
    render(<TestComponent fileInfos={{}} sendSpy={sendSpy} onInputSpy={vi.fn()} />);

    const editor = screen.getByTestId('editor');
    const file = new File(['PK'], 'extension.vsix', { type: 'text/plain' });
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: new MockClipboardData(
        {
          'text/plain': 'extension.vsix',
          'text/uri-list': 'file:///home/user/Downloads/extension.vsix',
        },
        [file],
      ),
    });

    fireEvent(editor, pasteEvent);

    expect(editor.querySelector('.opencode-chip.file-chip')).not.toBeInTheDocument();
    expect(editor.textContent).toBe('[extension.vsix](</home/user/Downloads/extension.vsix>)\n');
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('regression: should insert pasted extensionless files as Markdown absolute path references', () => {
    const sendSpy = vi.fn();
    render(<TestComponent fileInfos={{}} sendSpy={sendSpy} onInputSpy={vi.fn()} />);

    const editor = screen.getByTestId('editor');
    const file = new File(['\u007fELF'], 'opencode', { type: '' });
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: new MockClipboardData(
        {
          'text/plain': 'opencode',
          'text/uri-list': 'file:///usr/local/bin/opencode',
        },
        [file],
      ),
    });

    fireEvent(editor, pasteEvent);

    expect(editor.querySelector('.opencode-chip.file-chip')).not.toBeInTheDocument();
    expect(editor.textContent).toBe('[opencode](</usr/local/bin/opencode>)\n');
    expect(sendSpy).not.toHaveBeenCalled();
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

  it('should parse pasted single-line plain text and insert it as a text chip', () => {
    const onInputSpy = vi.fn();
    render(<TestComponent fileInfos={{}} sendSpy={vi.fn()} onInputSpy={onInputSpy} />);

    const editor = screen.getByTestId('editor');

    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: new MockClipboardData('hello world'),
    });

    fireEvent(editor, pasteEvent);

    const chip = editor.querySelector('.opencode-chip.text-chip');
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveAttribute('data-chip-text', 'hello world');
    expect(chip).toHaveAttribute('data-chip-lines-count', '1');
    expect(screen.getByText('Pasted 1 Lines')).toBeInTheDocument();
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

  it('regression: should not parse single-line comments starting with // as file paths but insert as text chip', () => {
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

    // It should insert it as a text chip
    const textChip = editor.querySelector('.opencode-chip.text-chip');
    expect(textChip).toBeInTheDocument();
    expect(textChip).toHaveAttribute('data-chip-text', '// ── 路径 A ──');
    expect(textChip).toHaveAttribute('data-chip-lines-count', '1');
  });

  it('regression: should not parse slash commands as file paths but insert as text chip', () => {
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

    // It should insert it as a text chip
    const textChip = editor.querySelector('.opencode-chip.text-chip');
    expect(textChip).toBeInTheDocument();
    expect(textChip).toHaveAttribute('data-chip-text', '/goal');
    expect(textChip).toHaveAttribute('data-chip-lines-count', '1');
  });
});
