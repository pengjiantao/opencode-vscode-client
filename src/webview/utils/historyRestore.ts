/**
 * @file Helpers for restoring a prompt history entry into the contenteditable
 * editor used by {@link PromptInput}.
 *
 * The history entry stores the expanded text the user submitted plus the rich
 * `Part[]` that backed chips. To round-trip into the editor:
 *  - text-only entries: set the editor's `innerText`.
 *  - parts-bearing entries: delegate to the existing
 *    `restoreUserMessageToEditor` for chip reconstruction, after cloning the
 *    parts with fresh random IDs to avoid colliding with any chips already in
 *    the DOM (e.g. the reverted message from a prior prompt).
 *
 * The helper also positions the editor selection at the requested end of the
 * buffer so a subsequent Up/Down press is registered as "at edge".
 */

import type { Part, PromptHistoryEntry } from '../../shared/types';
import { restoreUserMessageToEditor } from './editorRestore';

const randomId = (): string =>
  `hist-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;

/**
 * Recursively regenerates `id` fields on every part of a history entry, so the
 * chips we recreate in the editor don't share ids with any existing chips.
 */
function clonePartsWithFreshIDs(parts: readonly Part[]): Part[] {
  return parts.map((part) => {
    const rec = part as unknown as Record<string, unknown>;
    const cloned: Record<string, unknown> = { ...rec, id: randomId() };
    if (Array.isArray(cloned.parts)) {
      cloned.parts = clonePartsWithFreshIDs(cloned.parts as Part[]);
    }
    return cloned as Part;
  });
}

function placeCaretAtStart(editor: HTMLDivElement): void {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function placeCaretAtEnd(editor: HTMLDivElement): void {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * Restores a prompt history entry into the editor. Replaces existing content.
 *
 * @param editor The contenteditable editor element.
 * @param entry The history entry to display.
 * @param options.caret Where to place the cursor after restoring.
 */
export function restoreHistoryEntryToEditor(
  editor: HTMLDivElement,
  entry: PromptHistoryEntry,
  options: { caret: 'start' | 'end' } = { caret: 'end' },
): void {
  if (entry.parts.length === 0) {
    editor.innerHTML = '';
    if (entry.input) {
      editor.appendChild(document.createTextNode(entry.input));
    }
    if (options.caret === 'start') {
      placeCaretAtStart(editor);
    } else {
      placeCaretAtEnd(editor);
    }
    return;
  }

  const cloned = clonePartsWithFreshIDs(entry.parts);
  restoreUserMessageToEditor(editor, cloned);
  if (options.caret === 'start') {
    placeCaretAtStart(editor);
  } else {
    placeCaretAtEnd(editor);
  }
}

/**
 * Returns true when the editor's current selection is collapsed at the start
 * of the editor's text content. Used as the "Up at the top" guard before
 * invoking history navigation.
 */
export function isCaretAtEditorStart(editor: HTMLDivElement): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  const range = selection.getRangeAt(0);
  if (!range.collapsed) return false;

  // Treat the editor as the whole document; range.startOffset is the offset
  // within the start container. The safest cross-environment check is
  // "collapsed at a position with zero characters before it in the editor".
  const probe = document.createRange();
  probe.selectNodeContents(editor);
  probe.setEnd(range.startContainer, range.startOffset);
  return probe.toString().length === 0;
}

/**
 * Returns true when the editor's current selection is collapsed at the end of
 * the editor's text content.
 */
export function isCaretAtEditorEnd(editor: HTMLDivElement): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  const range = selection.getRangeAt(0);
  if (!range.collapsed) return false;

  const probe = document.createRange();
  probe.selectNodeContents(editor);
  probe.setStart(range.endContainer, range.endOffset);
  return probe.toString().length === 0;
}
