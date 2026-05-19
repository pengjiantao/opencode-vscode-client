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
  type: 'file' | 'image' | 'text';
  filename?: string;
  path?: string;
  text?: string;
  size?: number;
  mime?: string;
  isWorkspace?: boolean;
  dataUrl?: string;
  linesCount?: number;
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

      if (chip.type === 'file' && chip.path) {
        send({ type: 'file:query', path: chip.path });
      }

      const iconClass = getIconClass(chip.type, chip.mime);
      const displayLabel =
        chip.type === 'text' ? `Pasted ${chip.linesCount} Lines` : chip.filename || 'file';

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

      const removeBtn = document.createElement('button');
      removeBtn.className = 'chip-remove-btn';
      removeBtn.setAttribute('aria-label', 'Remove attachment');
      const closeI = document.createElement('i');
      closeI.className = 'codicon codicon-close';
      removeBtn.appendChild(closeI);
      chipNode.appendChild(removeBtn);

      const tooltipHtml = getTooltipHtml(chip, fileInfos);
      chipNode.setAttribute('data-custom-title', tooltipHtml);

      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chipNode.remove();
        onInput();
      });

      if (editorRef.current) {
        editorRef.current.focus();
      }

      if (range) {
        range.deleteContents();
        range.insertNode(chipNode);

        const spaceNode = document.createTextNode(' ');
        chipNode.parentNode?.insertBefore(spaceNode, chipNode.nextSibling);

        const newRange = document.createRange();
        newRange.setStart(spaceNode, 1);
        newRange.setEnd(spaceNode, 1);
        selection?.removeAllRanges();
        selection?.addRange(newRange);
      } else if (editorRef.current) {
        editorRef.current.appendChild(chipNode);
        const spaceNode = document.createTextNode(' ');
        editorRef.current.appendChild(spaceNode);

        const newRange = document.createRange();
        newRange.setStart(spaceNode, 1);
        newRange.setEnd(spaceNode, 1);
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

  return { insertChip, handlePaste };
}
