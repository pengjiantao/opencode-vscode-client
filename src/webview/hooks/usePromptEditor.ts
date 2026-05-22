/**
 * @file Custom React hook for managing PromptInput contenteditable DOM operations (chip insertion and paste handling).
 * Extracts complex DOM traversal and clipboard parsing to keep UI components focused and modular.
 */

import { useCallback } from 'react';
import type { WebviewToExt } from '../../shared/types';
import { getMimeType } from '../../shared/utils';
import { getChipDisplayLabel, getIconClass, getTooltipHtml } from '../utils/chipUtils';

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
 * Sets the cursor selection immediately after the specified node.
 *
 * @param node The DOM node to place the cursor after.
 */
function setCursorAfter(node: Node) {
  const selection = window.getSelection();
  const range = document.createRange();
  range.setStartAfter(node);
  range.setEndAfter(node);
  selection?.removeAllRanges();
  selection?.addRange(range);
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
      const displayLabel = getChipDisplayLabel(
        chip.type,
        chip.filename,
        chip.linesCount,
        chip.startLine,
        chip.endLine,
        chip.text,
      );

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
        setCursorAfter(chipNode);
      } else if (editorRef.current) {
        editorRef.current.appendChild(chipNode);
        setCursorAfter(chipNode);
      }

      onInput();
    },
    [editorRef, fileInfos, send, onInput],
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
        setCursorAfter(textNode);
      } else if (editorRef.current) {
        editorRef.current.appendChild(textNode);
        setCursorAfter(textNode);
      }

      onInput();
    },
    [editorRef, onInput],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const pastedText = e.clipboardData.getData('text/plain')?.trim();

      let isPastedPath = false;
      if (pastedText) {
        // A valid path should be a single line (no newlines).
        const isSingleLine = !pastedText.includes('\n') && !pastedText.includes('\r');
        if (isSingleLine) {
          // Check if it is a file:// URL.
          if (pastedText.startsWith('file://')) {
            isPastedPath = true;
          }
          // Check if it is a Windows absolute path (e.g. C:\path or D:/path).
          else if (/^[a-zA-Z]:[\\/]/.test(pastedText)) {
            isPastedPath = true;
          }
          // Check if it is a Unix absolute path.
          // It must start with a single slash (not double slashes like '//' for comments, or '/*' for block comments).
          // To prevent mistaking slash commands (e.g. /goal, /help) as paths, we ensure it contains
          // either another directory separator or an extension dot.
          else if (/^\/(?![\\/*\s])/.test(pastedText)) {
            const hasAdditionalSeparator = pastedText.indexOf('/', 1) !== -1;
            const hasExtension = /\.[a-zA-Z0-9]+$/.test(pastedText);
            if (hasAdditionalSeparator || hasExtension) {
              isPastedPath = true;
            }
          }
        }
      }

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
          const resolvedMime = getMimeType(pastedText);
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
        // Use custom DOM text insertion instead of deprecated document.execCommand to support sandboxed VS Code webview environments.
        insertText(pastedText);
      }
    },
    [insertChip, insertText],
  );

  return { insertChip, insertText, handlePaste };
}
