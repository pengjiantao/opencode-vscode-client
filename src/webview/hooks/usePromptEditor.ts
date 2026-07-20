/**
 * @file Custom React hook for managing PromptInput contenteditable DOM operations (chip insertion and paste handling).
 * Delegates clipboard parsing to utilities so this hook can focus on DOM insertion.
 */

import { useCallback } from 'react';
import type { WebviewToExt } from '../../shared/types';
import { getChipDisplayLabel, getIconClass, getTooltipContent } from '../utils/chipUtils';
import { ClipboardAttachmentUtils } from '../utils/clipboardAttachments';
import { getFileIconUrl } from '../utils/file-icons';
import { createInlineChipElement } from '../utils/inlineChipDom';

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
 * Hook providing chip insertion and clipboard paste execution for the prompt input editor.
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

      if (chip.type === 'file' && chip.path) {
        send({ type: 'file:query', path: chip.path });
      }

      const iconClass = getIconClass(chip.type, chip.mime);
      const iconUrl =
        (chip.type === 'file' || chip.type === 'code-selection') && chip.path
          ? getFileIconUrl(chip.path)
          : undefined;
      const displayLabel = getChipDisplayLabel(
        chip.type,
        chip.filename,
        chip.linesCount,
        chip.startLine,
        chip.endLine,
        chip.text,
      );
      const tooltipContent = getTooltipContent(
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

      const chipNode = createInlineChipElement({
        id: chip.id,
        type: chip.type,
        className: `opencode-chip ${chip.type}-chip inline-chip`,
        attributes: {
          ...(chip.filename && { 'data-chip-filename': chip.filename }),
          ...(chip.path && { 'data-chip-path': chip.path }),
          ...(chip.text && { 'data-chip-text': chip.text }),
          ...(chip.size && { 'data-chip-size': String(chip.size) }),
          ...(chip.mime && { 'data-chip-mime': chip.mime }),
          ...(chip.isWorkspace && { 'data-chip-is-workspace': 'true' }),
          ...(chip.dataUrl && { 'data-chip-data-url': chip.dataUrl }),
          ...(chip.linesCount && { 'data-chip-lines-count': String(chip.linesCount) }),
          ...(chip.startLine && { 'data-chip-start-line': String(chip.startLine) }),
          ...(chip.endLine && { 'data-chip-end-line': String(chip.endLine) }),
        },
        iconClass,
        iconUrl,
        label: displayLabel,
        tooltipContent,
      });

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
      const pastePlan = ClipboardAttachmentUtils.createPastePlan(e.clipboardData);
      if (!pastePlan.handled) {
        return;
      }

      e.preventDefault();

      for (const action of pastePlan.actions) {
        switch (action.type) {
          case 'image-file': {
            const reader = new FileReader();
            reader.onload = () => {
              insertChip({
                id: `img-${Math.random().toString(36).substring(7)}`,
                type: 'image',
                filename: action.filename,
                size: action.size,
                mime: action.mime,
                dataUrl: reader.result as string,
              });
            };
            reader.readAsDataURL(action.file);
            break;
          }
          case 'file-chip':
            insertChip({
              id: `file-path-${Math.random().toString(36).substring(7)}`,
              type: 'file',
              path: action.path,
              filename: action.filename,
              size: action.size,
              mime: action.mime,
            });
            break;
          case 'markdown-reference':
            insertText(action.text);
            break;
          case 'text-file': {
            const reader = new FileReader();
            reader.onload = () => {
              const textContent = reader.result as string;
              const linesCount = textContent.split('\n').length;
              insertChip({
                id: `file-${Math.random().toString(36).substring(7)}`,
                type: 'file',
                filename: action.filename,
                size: action.size,
                mime: action.mime,
                text: textContent,
                linesCount,
              });
            };
            reader.readAsText(action.file);
            break;
          }
          case 'text-chip':
            insertChip({
              id: `text-${Math.random().toString(36).substring(7)}`,
              type: 'text',
              filename: action.filename,
              text: action.text,
              linesCount: action.linesCount,
            });
            break;
          case 'resolve-file-path':
            send({
              type: 'clipboard:resolve-file-paths',
              requestID: `clipboard-paste-${Date.now()}-${Math.random().toString(36).substring(7)}`,
              files: [
                {
                  name: action.filename,
                  size: action.size,
                  mime: action.mime,
                },
              ],
            });
            break;
        }
      }
    },
    [insertChip, insertText, send],
  );

  return { insertChip, insertText, handlePaste };
}
