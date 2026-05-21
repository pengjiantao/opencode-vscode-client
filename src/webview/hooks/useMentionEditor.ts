/**
 * @file Custom React hook for managing file/directory mention popover states, IPC search triggering, and insertion.
 */

import React, { useCallback, useRef, useState } from 'react';
import type { WebviewToExt, WorkspaceSearchResult } from '../../shared/types';
import { getMimeType } from '../../shared/utils';
import { getIconClass, getTooltipHtml } from '../utils/chipUtils';
import { createInlineChipElement, insertInlineChipNode } from '../utils/inlineChipDom';

/** State shape for tracking the active autocomplete mention trigger session. */
export interface MentionState {
  /** Whether the mention list popover is visible */
  show: boolean;
  /** Current search query string typed after the @ character */
  query: string;
  /** Index in the text node where the trigger @ character was typed */
  startOffset: number;
  /** The text node containing the cursor selection and trigger character */
  textNode: Node | null;
}

/** Properties expected by the useMentionEditor hook. */
export interface UseMentionEditorProps {
  /** React ref pointing to the contenteditable prompt input container */
  editorRef: React.RefObject<HTMLDivElement>;
  /** File caching structure to pass down to chip tooltip constructor */
  fileInfos: Record<
    string,
    { exists: boolean; size: number; content?: string; isWorkspace: boolean }
  >;
  /** IPC function to send messages to the extension host */
  send: (msg: WebviewToExt) => void;
  /** Callback fired when editor contents are modified */
  onInput: () => void;
}

/**
 * Custom React hook managing file mention popovers, selection, IPC querying,
 * and DOM insertion of corresponding inline rich chips.
 */
export function useMentionEditor({ editorRef, fileInfos, send, onInput }: UseMentionEditorProps) {
  const [mentionState, setMentionState] = useState<MentionState>({
    show: false,
    query: '',
    startOffset: -1,
    textNode: null,
  });

  const [mentionResults, setMentionResults] = useState<WorkspaceSearchResult[]>([]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const mentionTimeoutRef = useRef<number | null>(null);

  /** Closes and resets the mention popover. */
  const closeMentionList = useCallback(() => {
    if (mentionTimeoutRef.current) {
      window.clearTimeout(mentionTimeoutRef.current);
      mentionTimeoutRef.current = null;
    }
    setMentionState({ show: false, query: '', startOffset: -1, textNode: null });
    setMentionResults([]);
    setSelectedIndex(0);
  }, []);

  /**
   * Triggers or updates the active mention search popover.
   *
   * @param textNode The text node containing the cursor selection.
   * @param atIndex The index of the '@' character in the text node.
   * @param query The search query string typed after the '@'.
   */
  const handleMentionTrigger = useCallback((textNode: Node, atIndex: number, query: string) => {
    setMentionState({
      show: true,
      query,
      startOffset: atIndex,
      textNode,
    });
  }, []);

  /**
   * Inserts an inline file mention rich chip node into the editor.
   *
   * @param item The file search result selected from the popover.
   */
  const insertMentionChip = useCallback(
    (item: WorkspaceSearchResult) => {
      if (!mentionState.textNode) return;

      const chipId = `file-${Math.random().toString(36).substring(7)}`;
      const chipType = 'file';
      const mime = item.type === 'dir' ? 'directory' : getMimeType(item.name);

      if (item.type === 'file') {
        send({ type: 'file:query', path: item.fsPath });
      }

      const iconClass = getIconClass(chipType, mime);
      const tooltipHtml = getTooltipHtml(
        {
          type: chipType,
          filename: item.name,
          path: item.fsPath,
          mime,
          isWorkspace: true,
        },
        fileInfos,
      );

      const chipNode = createInlineChipElement({
        id: chipId,
        type: chipType,
        className: 'opencode-chip file-chip inline-chip',
        attributes: {
          'data-chip-filename': item.name,
          'data-chip-path': item.fsPath,
          'data-chip-mime': mime,
          'data-chip-is-workspace': 'true',
        },
        iconClass,
        label: item.name,
        tooltipHtml,
      });

      if (editorRef.current) {
        editorRef.current.focus();
      }

      insertInlineChipNode(chipNode, mentionState.textNode, mentionState.startOffset, false);
      closeMentionList();
      onInput();
    },
    [mentionState, fileInfos, editorRef, send, closeMentionList, onInput],
  );

  return {
    mentionState,
    mentionResults,
    setMentionResults,
    selectedIndex,
    setSelectedIndex,
    mentionTimeoutRef,
    closeMentionList,
    handleMentionTrigger,
    insertMentionChip,
  };
}
