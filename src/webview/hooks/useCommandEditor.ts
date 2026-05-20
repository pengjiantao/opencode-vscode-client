/**
 * @file Custom React hook for managing command and skill search popover states, filtering, and insertion.
 */

import React, { useCallback, useMemo, useState } from 'react';
import type { CommandListItem } from '../components/CommandListPopover';
import { getCommandIconClass, getIconClass, getTooltipHtml } from '../utils/chipUtils';
import { createInlineChipElement, insertInlineChipNode } from '../utils/inlineChipDom';

/** State shape for tracking the active autocomplete slash trigger session. */
export interface CommandState {
  /** Whether the popover list is active and visible */
  show: boolean;
  /** Current search query string typed after the trigger character */
  query: string;
  /** Index in the text node where the trigger character was typed */
  startOffset: number;
  /** The text node containing the cursor selection and trigger character */
  textNode: Node | null;
  /** Whether the popover should only list skills (when text exists prior to trigger) */
  skillsOnly: boolean;
}

/** Properties expected by the useCommandEditor hook. */
export interface UseCommandEditorProps {
  /** React ref pointing to the contenteditable prompt input container */
  editorRef: React.RefObject<HTMLDivElement>;
  /** Complete list of commands registered on the backend server */
  commands: Array<{ name: string; description?: string; source?: 'command' | 'mcp' | 'skill' }>;
  /** Complete list of skills registered on the backend server */
  skills: Array<{ name: string; description?: string; content?: string }>;
  /** File caching structure to pass down to chip tooltip constructor */
  fileInfos: Record<
    string,
    { exists: boolean; size: number; content?: string; isWorkspace: boolean }
  >;
  /** Callback fired when editor contents are modified to trigger visual state recalculations */
  onInput: () => void;
}

/**
 * Custom React hook managing slash-triggered commands and skills popovers, selection,
 * search filtering, and DOM insertion of corresponding inline rich chips.
 */
export function useCommandEditor({
  editorRef,
  commands,
  skills,
  fileInfos,
  onInput,
}: UseCommandEditorProps) {
  const [commandState, setCommandState] = useState<CommandState>({
    show: false,
    query: '',
    startOffset: -1,
    textNode: null,
    skillsOnly: false,
  });

  const [commandSelectedIndex, setCommandSelectedIndex] = useState(0);

  // Compute locally filtered command and skill results for the popover
  const commandResults = useMemo((): CommandListItem[] => {
    const map = new Map<string, CommandListItem>();

    if (!commandState.skillsOnly) {
      for (const cmd of commands) {
        if (!map.has(cmd.name)) {
          map.set(cmd.name, {
            name: cmd.name,
            description: cmd.description,
            source: cmd.source || 'command',
          });
        }
      }
    }

    for (const skill of skills) {
      if (!map.has(skill.name)) {
        map.set(skill.name, {
          name: skill.name,
          description: skill.description,
          source: 'skill',
        });
      }
    }

    const merged = Array.from(map.values());

    if (!commandState.query) return merged;

    const q = commandState.query.toLowerCase();
    return merged.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q)),
    );
  }, [commands, skills, commandState.query, commandState.skillsOnly]);

  /** Closes and resets the command and skill search popover. */
  const closeCommandList = useCallback(() => {
    setCommandState({ show: false, query: '', startOffset: -1, textNode: null, skillsOnly: false });
    setCommandSelectedIndex(0);
  }, []);

  /**
   * Triggers or updates the active slash command search popover.
   *
   * @param textNode The text node containing the cursor selection.
   * @param slashIndex The starting index of the '/' trigger character in the text node.
   * @param query The search query string typed after the '/'.
   * @param skillsOnly Whether the popover list should only show skills.
   */
  const handleSlashTrigger = useCallback(
    (textNode: Node, slashIndex: number, query: string, skillsOnly: boolean) => {
      setCommandState((prev) => {
        const wasClosed = !prev.show;
        const queryChanged = query !== prev.query;
        if (wasClosed || queryChanged) {
          setCommandSelectedIndex(0);
        }
        return {
          show: true,
          query,
          startOffset: slashIndex,
          textNode,
          skillsOnly,
        };
      });
    },
    [],
  );

  /**
   * Inserts an inline command rich chip node into the editor.
   *
   * @param item The CommandListItem selected from the popover.
   */
  const insertCommandChip = useCallback(
    (item: CommandListItem) => {
      if (!commandState.textNode) return;

      const chipId = `cmd-${Math.random().toString(36).substring(7)}`;
      const iconClass = getCommandIconClass(item.source);
      const tooltipHtml = getTooltipHtml(
        {
          type: 'command',
          filename: item.name,
        },
        fileInfos,
      );

      const chipNode = createInlineChipElement({
        id: chipId,
        type: 'command',
        className: 'opencode-chip command-chip inline-chip',
        attributes: {
          'data-chip-filename': item.name,
          'data-chip-command-name': item.name,
          'data-chip-command-source': item.source,
        },
        iconClass,
        label: item.name,
        tooltipHtml,
      });

      if (editorRef.current) {
        editorRef.current.focus();
      }

      insertInlineChipNode(chipNode, commandState.textNode, commandState.startOffset, true);
      closeCommandList();
      onInput();
    },
    [commandState, fileInfos, editorRef, closeCommandList, onInput],
  );

  /**
   * Inserts an inline skill rich chip node into the editor.
   *
   * @param item The CommandListItem representing a skill selected from the popover.
   */
  const insertSkillChip = useCallback(
    (item: CommandListItem) => {
      if (!commandState.textNode) return;

      const skill = skills.find((s) => s.name === item.name);
      const skillContent = skill?.content || '';

      const chipId = `skill-${Math.random().toString(36).substring(7)}`;
      const iconClass = getIconClass('skill');
      const tooltipHtml = getTooltipHtml(
        {
          type: 'skill',
          filename: item.name,
          text: skillContent,
        },
        fileInfos,
      );

      const chipNode = createInlineChipElement({
        id: chipId,
        type: 'skill',
        className: 'opencode-chip skill-chip inline-chip',
        attributes: {
          'data-chip-filename': item.name,
          'data-chip-text': skillContent,
          'data-chip-skill-description': item.description || '',
        },
        iconClass,
        label: item.name,
        tooltipHtml,
      });

      if (editorRef.current) {
        editorRef.current.focus();
      }

      insertInlineChipNode(chipNode, commandState.textNode, commandState.startOffset, false);
      closeCommandList();
      onInput();
    },
    [commandState, skills, fileInfos, editorRef, closeCommandList, onInput],
  );

  /**
   * Helper that dispatches selection to the appropriate command or skill insertion handler.
   *
   * @param item The selected command/skill list item.
   */
  const onSelectCommandItem = useCallback(
    (item: CommandListItem) => {
      if (item.source === 'skill' && skills.some((s) => s.name === item.name)) {
        insertSkillChip(item);
      } else {
        insertCommandChip(item);
      }
    },
    [insertCommandChip, insertSkillChip, skills],
  );

  return {
    commandState,
    commandSelectedIndex,
    setCommandSelectedIndex,
    commandResults,
    closeCommandList,
    handleSlashTrigger,
    onSelectCommandItem,
  };
}
