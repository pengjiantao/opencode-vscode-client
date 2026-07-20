/**
 * @file Utility for restoring user message parts back into the prompt input editor.
 * Used by the revert feature to repopulate the input box with the reverted user message.
 */

import type { Part } from '@opencode-ai/sdk/v2/client';
import { getChipDisplayLabel, getIconClass, getTooltipContent, parseFileUrl } from './chipUtils';
import { getFileIconUrl } from './file-icons';
import { createInlineChipElement } from './inlineChipDom';

/** Map of file paths to their cached information from the extension host. */
export type FileInfoMap = Record<
  string,
  { exists: boolean; size: number; content?: string; isWorkspace: boolean }
>;

/** Checks if a text part is a display text part (not a metadata/backing part). */
function isDisplayTextPart(part: Part): boolean {
  if (part.type !== 'text') return false;
  const metadata = (part as { metadata?: { type?: unknown } }).metadata;
  const metaType = metadata?.type;
  return metaType !== 'pasted-text' && metaType !== 'command' && metaType !== 'skill';
}

/** Checks if a text part is an inline metadata part (backs a chip in display text). */
function isInlinePayloadPart(part: Part): boolean {
  if (part.type !== 'text') return false;
  const metadata = (part as { metadata?: { type?: unknown } }).metadata;
  return metadata?.type === 'command' || metadata?.type === 'skill';
}

/** Extracts the inline placeholder text for a command or skill metadata part. */
function getInlinePlaceholder(part: Part): string | undefined {
  if (!isInlinePayloadPart(part)) return undefined;
  const rec = part as unknown as Record<string, unknown>;
  const metadata = rec.metadata as {
    type: string;
    command?: string;
    name?: string;
    placeholder?: string;
  };
  return (
    metadata.placeholder ||
    `[${metadata.type === 'command' ? 'Command' : 'Skill'}: ${metadata.type === 'command' ? metadata.command : metadata.name}]`
  );
}

/** Creates a chip DOM element matching the PromptInput's chip rendering. */
function createChipElement(
  chip: {
    id: string;
    type: 'file' | 'image' | 'text' | 'code-selection' | 'terminal' | 'command' | 'skill';
    filename?: string;
    path?: string;
    text?: string;
    mime?: string;
    dataUrl?: string;
    linesCount?: number;
    startLine?: number;
    endLine?: number;
  },
  fileInfos: FileInfoMap,
): HTMLElement {
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
  const tooltipContent = getTooltipContent(chip, fileInfos);

  const cached = chip.path ? fileInfos[chip.path] : undefined;
  const isWorkspace = cached?.isWorkspace ?? false;

  return createInlineChipElement({
    id: chip.id,
    type: chip.type,
    className: `opencode-chip ${chip.type}-chip inline-chip`,
    attributes: {
      ...(chip.filename && { 'data-chip-filename': chip.filename }),
      ...(chip.path && { 'data-chip-path': chip.path }),
      ...(chip.text && { 'data-chip-text': chip.text }),
      ...(chip.mime && { 'data-chip-mime': chip.mime }),
      ...(chip.dataUrl && { 'data-chip-data-url': chip.dataUrl }),
      ...(chip.linesCount && { 'data-chip-lines-count': String(chip.linesCount) }),
      ...(chip.startLine && { 'data-chip-start-line': String(chip.startLine) }),
      ...(chip.endLine && { 'data-chip-end-line': String(chip.endLine) }),
      'data-chip-is-workspace': String(isWorkspace),
    },
    iconClass,
    iconUrl,
    label: displayLabel,
    tooltipContent,
  });
}

/**
 * Restores user message parts into the prompt input editor.
 * Clears the editor and rebuilds it with text and chip DOM nodes
 * matching the original user message structure.
 *
 * @param editor The contenteditable editor element.
 * @param userParts The parts array from the user message.
 * @param activeSessionID The current active session ID.
 */
export function restoreUserMessageToEditor(
  editor: HTMLDivElement,
  userParts: Part[],
  fileInfos: FileInfoMap = {},
): void {
  // Clear existing content
  editor.innerHTML = '';

  // Separate parts by role
  const displayParts = userParts.filter(
    (p) => isDisplayTextPart(p) && !(p as { synthetic?: boolean }).synthetic,
  );
  const inlineParts = userParts.filter(isInlinePayloadPart);
  const fileParts = userParts.filter((p) => p.type === 'file');

  // Build the main display text
  const mainText = displayParts
    .map((p) => ('text' in p ? (p as { text: string }).text : ''))
    .join('');

  if (!mainText && fileParts.length === 0 && inlineParts.length === 0) {
    // Nothing to restore
    return;
  }

  // Build a list of all chip placeholders to replace in the text
  interface ChipEntry {
    placeholder: string;
    chipData: {
      id: string;
      type: 'file' | 'image' | 'text' | 'code-selection' | 'terminal' | 'command' | 'skill';
      filename?: string;
      path?: string;
      text?: string;
      mime?: string;
      dataUrl?: string;
      linesCount?: number;
      startLine?: number;
      endLine?: number;
    };
  }

  const chipEntries: ChipEntry[] = [];

  // File parts -> [File: ...], [Image: ...], [Code Selection: ...], or [Terminal: ...] placeholders
  for (const fp of fileParts) {
    if (fp.type !== 'file') continue;
    const rec = fp as unknown as Record<string, unknown>;
    const source = rec.source as
      | { path?: string; text?: { value?: string; start?: number; end?: number } }
      | undefined;
    const isImage = fp.mime?.startsWith('image/');
    const isTerminal = fp.filename?.startsWith('terminal [');
    // Must check terminal before code-selection since terminal parts also have source.text
    const isCodeSelection = !isTerminal && !!source?.text?.start;

    let placeholder: string;
    let chipType: 'file' | 'image' | 'code-selection' | 'terminal';
    let chipFilename: string | undefined;
    let chipPath: string | undefined;
    let chipText: string | undefined;
    let linesCount: number | undefined;
    let startLine: number | undefined;
    let endLine: number | undefined;

    if (isCodeSelection) {
      chipType = 'code-selection';
      chipFilename = fp.filename;
      chipPath = source?.path;
      chipText = source?.text?.value;
      startLine = source?.text?.start;
      endLine = source?.text?.end;
      placeholder = `[Code Selection: ${fp.filename}]`;
    } else if (isTerminal) {
      chipType = 'terminal';
      chipFilename = fp.filename;
      // Extract lines count from "terminal [N lines]"
      const match = fp.filename?.match(/terminal \[(\d+) lines?\]/);
      linesCount = match ? Number(match[1]) : undefined;
      chipText = source?.text?.value;
      placeholder = `[Terminal: ${linesCount ?? '?'} lines]`;
    } else if (isImage) {
      chipType = 'image';
      chipFilename = fp.filename;
      placeholder = `[Image: ${fp.filename}]`;
    } else {
      chipType = 'file';
      chipFilename = fp.filename;
      chipPath = source?.path ?? parseFileUrl(fp.url, fp.mime).path;
      placeholder = `[File: ${fp.filename}]`;
    }

    chipEntries.push({
      placeholder,
      chipData: {
        id: fp.id,
        type: chipType,
        filename: chipFilename,
        path: chipPath,
        text: chipText,
        mime: fp.mime,
        dataUrl: fp.url?.startsWith('data:') ? fp.url : undefined,
        linesCount,
        startLine,
        endLine,
      },
    });
  }

  // Inline command/skill parts -> [Command: ...] or [Skill: ...] placeholders
  for (const ip of inlineParts) {
    const placeholder = getInlinePlaceholder(ip);
    if (!placeholder) continue;
    const rec = ip as unknown as Record<string, unknown>;
    const metadata = rec.metadata as { type: string; command?: string; name?: string };
    chipEntries.push({
      placeholder,
      chipData: {
        id: ip.id,
        type: metadata.type as 'command' | 'skill',
        filename: metadata.type === 'command' ? metadata.command : metadata.name,
        text: 'text' in ip ? (ip as { text: string }).text : undefined,
      },
    });
  }

  // Pasted-text parts (text with metadata.type === 'pasted-text') -> [Text: ...] placeholders
  for (const p of userParts) {
    if (p.type !== 'text') continue;
    const rec = p as unknown as Record<string, unknown>;
    const metadata = rec.metadata as
      | { type?: string; linesCount?: number; filename?: string }
      | undefined;
    if (metadata?.type !== 'pasted-text') continue;
    const filename = metadata.filename || 'Pasted text';
    const linesCount = metadata.linesCount;
    const placeholder = `[Text: ${filename}]`;
    chipEntries.push({
      placeholder,
      chipData: {
        id: p.id,
        type: 'text',
        filename,
        text: 'text' in p ? (p as { text: string }).text : undefined,
        linesCount,
      },
    });
  }

  // Replace placeholders in text with chip DOM nodes
  const fragment = document.createDocumentFragment();
  let remaining = mainText;

  while (remaining.length > 0) {
    let earliestIndex = -1;
    let earliestEntry: ChipEntry | null = null;

    for (const entry of chipEntries) {
      const idx = remaining.indexOf(entry.placeholder);
      if (idx !== -1 && (earliestIndex === -1 || idx < earliestIndex)) {
        earliestIndex = idx;
        earliestEntry = entry;
      }
    }

    if (earliestEntry && earliestIndex !== -1) {
      // Append text before the placeholder
      if (earliestIndex > 0) {
        fragment.appendChild(document.createTextNode(remaining.slice(0, earliestIndex)));
      }
      // Create and append chip node
      const chipNode = createChipElement(earliestEntry.chipData, fileInfos);
      fragment.appendChild(chipNode);
      remaining = remaining.slice(earliestIndex + earliestEntry.placeholder.length);
    } else {
      // No more placeholders, append remaining text
      if (remaining.length > 0) {
        fragment.appendChild(document.createTextNode(remaining));
      }
      break;
    }
  }

  // If there was no text but we have file parts without matching placeholders,
  // append them as trailing chips
  if (mainText.length === 0 && chipEntries.length > 0) {
    for (const entry of chipEntries) {
      const chipNode = createChipElement(entry.chipData, fileInfos);
      fragment.appendChild(chipNode);
      fragment.appendChild(document.createTextNode(' '));
    }
  }

  editor.appendChild(fragment);
}
