/**
 * @file Utility helpers for serializing prompt editor HTML elements into API payload text and parts.
 */

import type { Part } from '@opencode-ai/sdk/v2/client';
import { FILENAME_LINE_RANGE_PATTERN, pathToFileUrl } from '../../shared/utils';

/**
 * Traverses the editor DOM tree and extracts text (with inline placeholders) and parts.
 *
 * @param element The editor element.
 * @param activeSessionID The active session ID.
 * @param fileInfos The current session file cache.
 * @returns An object containing the serialized prompt text and parts list.
 */
export const getPromptData = (
  element: HTMLDivElement | null,
  activeSessionID: string | null,
  fileInfos: Record<
    string,
    { exists: boolean; size: number; content?: string; isWorkspace: boolean }
  >,
): { text: string; parts: Part[] } => {
  if (!element) return { text: '', parts: [] };

  // Fallback for jsdom tests that fire input event with target.value on the div
  if (element.childNodes.length === 0 && 'value' in element) {
    const textVal = (element as unknown as { value: string }).value;
    return {
      text: textVal,
      parts: [],
    };
  }

  let promptText = '';
  const parts: Part[] = [];

  const traverse = (node: Node) => {
    if (node.nodeType === 3) {
      promptText += (node.textContent || '').replace(/\u00A0/g, ' ');
    } else if (node.nodeType === 1) {
      const el = node as HTMLElement;
      if (el.classList.contains('opencode-chip')) {
        const type = el.getAttribute('data-chip-type') as
          | 'file'
          | 'image'
          | 'text'
          | 'code-selection'
          | 'terminal'
          | 'command'
          | 'skill';
        const id = el.getAttribute('data-chip-id') || '';
        const filename = el.getAttribute('data-chip-filename') || 'file';
        const path = el.getAttribute('data-chip-path') || undefined;
        const chipText = el.getAttribute('data-chip-text') || '';
        const mime = el.getAttribute('data-chip-mime') || 'text/plain';
        const dataUrl = el.getAttribute('data-chip-data-url') || undefined;
        const linesCount = Number(el.getAttribute('data-chip-lines-count') || '0');
        const startLine = Number(el.getAttribute('data-chip-start-line') || '1');
        const endLine = Number(el.getAttribute('data-chip-end-line') || '1');

        if (type === 'image') {
          promptText += `[Image: ${filename}]`;
          parts.push({
            type: 'file',
            id,
            sessionID: activeSessionID || 'temp',
            messageID: 'temp',
            mime: mime || 'image/png',
            filename,
            url: dataUrl || '',
          } as unknown as Part);
        } else if (type === 'text') {
          promptText += `[Text: ${filename}]`;
          parts.push({
            type: 'text',
            id,
            sessionID: activeSessionID || 'temp',
            messageID: 'temp',
            text: chipText,
            metadata: {
              type: 'pasted-text',
              linesCount,
              filename,
            },
          } as unknown as Part);
        } else if (type === 'code-selection') {
          const displayRange = `[${startLine}-${endLine}]`;
          let cleanFilename = filename || 'file';
          if (FILENAME_LINE_RANGE_PATTERN.test(cleanFilename)) {
            cleanFilename = cleanFilename.replace(FILENAME_LINE_RANGE_PATTERN, '');
          }
          promptText += `[Code Selection: ${cleanFilename} ${displayRange}]`;
          let finalUrl: string;
          if (path) {
            finalUrl = pathToFileUrl(path);
          } else {
            const MAX_DATA_URL_LIMIT = 50 * 1024;
            const truncatedText =
              chipText.length > MAX_DATA_URL_LIMIT
                ? chipText.slice(0, MAX_DATA_URL_LIMIT) + '\n... (truncated due to size limit)'
                : chipText;
            const base64Content = btoa(unescape(encodeURIComponent(truncatedText)));
            finalUrl = `data:${mime || 'text/plain'};base64,${base64Content}`;
          }
          const source = {
            type: 'file' as const,
            path: path || cleanFilename,
            text: {
              value: chipText,
              start: startLine,
              end: endLine,
            },
          };
          parts.push({
            type: 'file',
            id,
            sessionID: activeSessionID || 'temp',
            messageID: 'temp',
            mime: mime || 'text/plain',
            filename: `${cleanFilename} ${displayRange}`,
            url: finalUrl,
            source,
          } as unknown as Part);
        } else if (type === 'terminal') {
          promptText += `[Terminal: ${linesCount} lines]`;
          const MAX_DATA_URL_LIMIT = 50 * 1024;
          const truncatedText =
            chipText.length > MAX_DATA_URL_LIMIT
              ? chipText.slice(0, MAX_DATA_URL_LIMIT) + '\n... (truncated due to size limit)'
              : chipText;
          const base64Content = btoa(unescape(encodeURIComponent(truncatedText)));
          const finalUrl = `data:text/plain;base64,${base64Content}`;
          const source = {
            type: 'file' as const,
            path: `terminal-${id}`,
            text: {
              value: chipText,
              start: 1,
              end: linesCount,
            },
          };
          parts.push({
            type: 'file',
            id,
            sessionID: activeSessionID || 'temp',
            messageID: 'temp',
            mime: 'text/plain',
            filename: `terminal [${linesCount} lines]`,
            url: finalUrl,
            source,
          } as unknown as Part);
        } else if (type === 'command') {
          const commandName = el.getAttribute('data-chip-command-name') || filename;
          const commandSource = el.getAttribute('data-chip-command-source') || undefined;
          const placeholder = `[Command: ${commandName}]`;
          const startOffset = promptText.length;
          promptText += placeholder;
          parts.push({
            type: 'text',
            id,
            sessionID: activeSessionID || 'temp',
            messageID: 'temp',
            text: commandName,
            metadata: {
              type: 'command',
              command: commandName,
              source: commandSource,
              placeholder,
              startOffset,
              endOffset: startOffset + placeholder.length,
            },
          } as unknown as Part);
        } else if (type === 'skill') {
          const skillContent = chipText || '';
          const skillDesc = el.getAttribute('data-chip-skill-description') || '';
          const placeholder = `[Skill: ${filename}]`;
          const startOffset = promptText.length;
          promptText += placeholder;
          parts.push({
            type: 'text',
            id,
            sessionID: activeSessionID || 'temp',
            messageID: 'temp',
            text: skillContent,
            metadata: {
              type: 'skill',
              name: filename,
              description: skillDesc,
              placeholder,
              startOffset,
              endOffset: startOffset + placeholder.length,
            },
          } as unknown as Part);
        } else if (type === 'file') {
          promptText += `[File: ${filename}]`;
          const cached = path ? fileInfos[path] : undefined;
          let finalUrl: string;
          if (path) {
            finalUrl = pathToFileUrl(path);
          } else if (dataUrl) {
            finalUrl = dataUrl;
          } else {
            const fileContent = chipText || cached?.content || '';
            const MAX_DATA_URL_LIMIT = 50 * 1024;
            const truncatedText =
              fileContent.length > MAX_DATA_URL_LIMIT
                ? fileContent.slice(0, MAX_DATA_URL_LIMIT) + '\n... (truncated due to size limit)'
                : fileContent;
            const base64Content = btoa(unescape(encodeURIComponent(truncatedText)));
            const dataUrlMime = mime.startsWith('text/') ? 'text/plain' : mime || 'text/plain';
            finalUrl = `data:${dataUrlMime};base64,${base64Content}`;
          }
          // Do not create source object for whole files and directories to avoid backend schema validation errors
          // and to prevent rendering them as code selections with line ranges (e.g. [1-1]) in the chat history.
          // Code selection parts (which have a defined line range) are handled separately under type === 'code-selection'.
          parts.push({
            type: 'file',
            id,
            sessionID: activeSessionID || 'temp',
            messageID: 'temp',
            mime,
            filename,
            url: finalUrl,
          } as unknown as Part);
        }
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          traverse(node.childNodes[i]);
        }
        if (el.tagName === 'DIV' || el.tagName === 'P' || el.tagName === 'BR') {
          if (node.nextSibling) {
            promptText += '\n';
          }
        }
      }
    }
  };

  for (let i = 0; i < element.childNodes.length; i++) {
    traverse(element.childNodes[i]);
  }

  return { text: promptText, parts };
};
