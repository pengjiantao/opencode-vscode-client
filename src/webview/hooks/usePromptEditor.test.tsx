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

  it('should remove the chip when the close button is clicked', () => {
    const onInputSpy = vi.fn();
    render(<TestComponent fileInfos={{}} sendSpy={vi.fn()} onInputSpy={onInputSpy} />);

    const editor = screen.getByTestId('editor');
    const button = screen.getByTestId('btn-insert-file');
    fireEvent.click(button);

    const chip = editor.querySelector('.opencode-chip.file-chip');
    expect(chip).toBeInTheDocument();

    const removeBtn = chip?.querySelector('.chip-remove-btn');
    expect(removeBtn).toBeInTheDocument();

    onInputSpy.mockClear();
    fireEvent.click(removeBtn!);

    expect(chip).not.toBeInTheDocument();
    expect(onInputSpy).toHaveBeenCalled();
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
});
