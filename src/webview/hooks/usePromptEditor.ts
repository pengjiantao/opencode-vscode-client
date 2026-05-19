/**
 * @file Custom React hook for managing PromptInput contenteditable DOM operations (chip insertion and paste handling).
 * Extracts complex DOM traversal and clipboard parsing to keep UI components focused and modular.
 */

import { useCallback } from 'react';
import type { WebviewToExt } from '../../shared/types';
import { getIconClass, getTooltipHtml } from '../utils/chipUtils';

/**
 * Interface representing the properties required by the usePromptEditor hook.
 */
export interface UsePromptEditorProps {
  /** Reference to the contenteditable editor div element */
  editorRef: React.RefObject<HTMLDivElement>;
  /** Map of queried file information/previews from extension host */
  fileInfos: Record<
    string,
    { exists: boolean; size: number; content?: string; isWorkspace: boolean }
  >;
  /** IPC function to send messages to the extension host */
  send: (msg: WebviewToExt) => void;
  /** Callback to trigger when the editor's text content changes */
  onInput: () => void;
}

/**
 * Interface representing an inline attachment chip.
 */
export interface EditorChip {
  id: string;
  type: 'file' | 'image' | 'text' | 'code-selection' | 'terminal';
  filename?: string;
  path?: string;
  text?: string;
  size?: number;
  mime?: string;
  isWorkspace?: boolean;
  dataUrl?: string;
  linesCount?: number;
  startLine?: number;
  endLine?: number;
}

/**
 * Hook providing chip insertion and clipboard paste parsing logic for the prompt input editor.
 */
export function usePromptEditor({ editorRef, fileInfos, send, onInput }: UsePromptEditorProps) {
  const insertChip = useCallback(
    (chip: EditorChip) => {
      const selection = window.getSelection();
      let range: Range | null = null;
      if (selection && selection.rangeCount > 0) {
        const potentialRange = selection.getRangeAt(0);
        if (
          editorRef.current &&
          editorRef.current.contains(potentialRange.commonAncestorContainer)
        ) {
          range = potentialRange;
        }
      }

      const chipNode = document.createElement('span');
      chipNode.className = `opencode-chip ${chip.type}-chip inline-chip`;
      chipNode.contentEditable = 'false';
      chipNode.setAttribute('data-chip-id', chip.id);
      chipNode.setAttribute('data-chip-type', chip.type);
      if (chip.filename) chipNode.setAttribute('data-chip-filename', chip.filename);
      if (chip.path) chipNode.setAttribute('data-chip-path', chip.path);
      if (chip.text) chipNode.setAttribute('data-chip-text', chip.text);
      if (chip.size) chipNode.setAttribute('data-chip-size', String(chip.size));
      if (chip.mime) chipNode.setAttribute('data-chip-mime', chip.mime);
      if (chip.isWorkspace) chipNode.setAttribute('data-chip-is-workspace', 'true');
      if (chip.dataUrl) chipNode.setAttribute('data-chip-data-url', chip.dataUrl);
      if (chip.linesCount) chipNode.setAttribute('data-chip-lines-count', String(chip.linesCount));
      if (chip.startLine) chipNode.setAttribute('data-chip-start-line', String(chip.startLine));
      if (chip.endLine) chipNode.setAttribute('data-chip-end-line', String(chip.endLine));

      if (chip.type === 'file' && chip.path) {
        send({ type: 'file:query', path: chip.path });
      }

      const iconClass = getIconClass(chip.type, chip.mime);
      let displayLabel = chip.filename || 'file';
      if (chip.type === 'text') {
        displayLabel = `Pasted ${chip.linesCount} Lines`;
      } else if (chip.type === 'code-selection') {
        displayLabel = `${chip.filename} [${chip.startLine || 1}-${chip.endLine || 1}]`;
      } else if (chip.type === 'terminal') {
        displayLabel = `terminal[${chip.linesCount || 1} lines]`;
      }

      const iconSpan = document.createElement('span');
      iconSpan.className = 'chip-icon';
      const iconI = document.createElement('i');
      iconI.className = `codicon codicon-${iconClass}`;
      iconSpan.appendChild(iconI);
      chipNode.appendChild(iconSpan);

      const labelSpan = document.createElement('span');
      labelSpan.className = 'chip-label';
      labelSpan.textContent = displayLabel;
      chipNode.appendChild(labelSpan);

      const tooltipHtml = getTooltipHtml(
        {
          type: chip.type,
          filename: chip.filename,
          path: chip.path,
          text: chip.text,
          size: chip.size,
          mime: chip.mime,
          isWorkspace: chip.isWorkspace,
          dataUrl: chip.dataUrl,
          linesCount: chip.linesCount,
          startLine: chip.startLine,
          endLine: chip.endLine,
        },
        fileInfos,
      );
      chipNode.setAttribute('data-custom-title', tooltipHtml);

      if (editorRef.current) {
        editorRef.current.focus();
      }

      if (range) {
        range.deleteContents();
        range.insertNode(chipNode);

        const newRange = document.createRange();
        newRange.setStartAfter(chipNode);
        newRange.setEndAfter(chipNode);
        selection?.removeAllRanges();
        selection?.addRange(newRange);
      } else if (editorRef.current) {
        editorRef.current.appendChild(chipNode);

        const newRange = document.createRange();
        newRange.setStartAfter(chipNode);
        newRange.setEndAfter(chipNode);
        selection?.removeAllRanges();
        selection?.addRange(newRange);
      }

      onInput();
    },
    [editorRef, fileInfos, send, onInput],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const pastedText = e.clipboardData.getData('text/plain')?.trim();
      const pathPattern = /^(file:\/\/|\/|[a-zA-Z]:\\).+/;
      const isPastedPath = pastedText && pathPattern.test(pastedText);

      if (e.clipboardData.files && e.clipboardData.files.length > 0) {
        const files = Array.from(e.clipboardData.files);
        let handled = false;

        for (const file of files) {
          if (file.type.startsWith('image/')) {
            e.preventDefault();
            handled = true;
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = reader.result as string;
              insertChip({
                id: `img-${Math.random().toString(36).substring(7)}`,
                type: 'image',
                filename: file.name || 'Pasted Image',
                size: file.size,
                mime: file.type,
                dataUrl,
              });
            };
            reader.readAsDataURL(file);
          } else {
            const resolvedPath =
              (file as unknown as { path?: string }).path ||
              (isPastedPath ? pastedText : undefined);
            if (resolvedPath) {
              e.preventDefault();
              handled = true;
              const isImage =
                file.type?.startsWith('image/') ||
                resolvedPath.toLowerCase().endsWith('.png') ||
                resolvedPath.toLowerCase().endsWith('.jpg') ||
                resolvedPath.toLowerCase().endsWith('.jpeg') ||
                resolvedPath.toLowerCase().endsWith('.gif') ||
                resolvedPath.toLowerCase().endsWith('.webp');
              const isPdf =
                file.type === 'application/pdf' || resolvedPath.toLowerCase().endsWith('.pdf');
              const resolvedMime = isImage
                ? file.type || 'image/png'
                : isPdf
                  ? 'application/pdf'
                  : 'text/plain';
              insertChip({
                id: `file-path-${Math.random().toString(36).substring(7)}`,
                type: 'file',
                path: resolvedPath,
                filename: file.name || resolvedPath.split(/[\\/]/).pop() || 'file',
                size: file.size,
                mime: resolvedMime,
              });
            } else {
              e.preventDefault();
              handled = true;
              const reader = new FileReader();
              reader.onload = () => {
                const textContent = reader.result as string;
                const linesCount = textContent.split('\n').length;
                const isImage =
                  file.type?.startsWith('image/') ||
                  file.name.toLowerCase().endsWith('.png') ||
                  file.name.toLowerCase().endsWith('.jpg') ||
                  file.name.toLowerCase().endsWith('.jpeg') ||
                  file.name.toLowerCase().endsWith('.gif') ||
                  file.name.toLowerCase().endsWith('.webp');
                const isPdf =
                  file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                const resolvedMime = isImage
                  ? file.type || 'image/png'
                  : isPdf
                    ? 'application/pdf'
                    : 'text/plain';
                insertChip({
                  id: `file-${Math.random().toString(36).substring(7)}`,
                  type: 'file',
                  filename: file.name,
                  size: file.size,
                  mime: resolvedMime,
                  text: textContent,
                  linesCount,
                });
              };
              reader.readAsText(file);
            }
          }
        }

        if (handled) return;
      }

      if (pastedText) {
        if (isPastedPath) {
          e.preventDefault();
          const isImage =
            pastedText.toLowerCase().endsWith('.png') ||
            pastedText.toLowerCase().endsWith('.jpg') ||
            pastedText.toLowerCase().endsWith('.jpeg') ||
            pastedText.toLowerCase().endsWith('.gif') ||
            pastedText.toLowerCase().endsWith('.webp');
          const isPdf = pastedText.toLowerCase().endsWith('.pdf');
          const resolvedMime = isImage ? 'image/png' : isPdf ? 'application/pdf' : 'text/plain';
          insertChip({
            id: `file-path-${Math.random().toString(36).substring(7)}`,
            type: 'file',
            path: pastedText,
            filename: pastedText.split(/[\\/]/).pop() || 'file',
            mime: resolvedMime,
          });
          return;
        }

        if (pastedText.includes('\n') || pastedText.includes('\r')) {
          e.preventDefault();
          const linesCount = pastedText.split(/\r?\n/).length;
          insertChip({
            id: `text-${Math.random().toString(36).substring(7)}`,
            type: 'text',
            filename: `Pasted ${linesCount} Lines`,
            text: pastedText,
            linesCount,
          });
          return;
        }

        e.preventDefault();
        document.execCommand('insertText', false, pastedText);
        onInput();
      }
    },
    [insertChip, onInput],
  );

  /**
   * Inserts a plain text node at the current cursor selection position in the editor.
   * If there is no active selection inside the editor, appends the text node at the end.
   *
   * @param text The plain text content to insert.
   */
  const insertText = useCallback(
    (text: string) => {
      const selection = window.getSelection();
      let range: Range | null = null;
      if (selection && selection.rangeCount > 0) {
        const potentialRange = selection.getRangeAt(0);
        if (
          editorRef.current &&
          editorRef.current.contains(potentialRange.commonAncestorContainer)
        ) {
          range = potentialRange;
        }
      }

      const textNode = document.createTextNode(text);

      if (range) {
        range.deleteContents();
        range.insertNode(textNode);

        const newRange = document.createRange();
        newRange.setStartAfter(textNode);
        newRange.setEndAfter(textNode);
        selection?.removeAllRanges();
        selection?.addRange(newRange);
      } else if (editorRef.current) {
        editorRef.current.appendChild(textNode);

        const newRange = document.createRange();
        newRange.setStartAfter(textNode);
        newRange.setEndAfter(textNode);
        selection?.removeAllRanges();
        selection?.addRange(newRange);
      }

      onInput();
    },
    [editorRef, onInput],
  );

  return { insertChip, insertText, handlePaste };
}
