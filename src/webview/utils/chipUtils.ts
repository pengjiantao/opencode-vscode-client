/**
 * @file Utility helpers for parsing, formatting, and serializing inline attachment chips.
 */

import type { Part } from '@opencode-ai/sdk/v2/client';

const FILENAME_LINE_RANGE_PATTERN = /\s*\[(\d+)-(\d+)\]$/;

/** Line range parsed from an explicit code-selection chip label. */
export interface ParsedLineRange {
  /** One-based start line. */
  startLine: number;
  /** One-based end line. */
  endLine: number;
}

/**
 * Extracts an explicit line range suffix from a code-selection filename.
 *
 * @param filename The display filename that may end with " [start-end]".
 * @returns The parsed line range, or undefined when no explicit suffix exists.
 */
export function parseFilenameLineRange(filename?: string): ParsedLineRange | undefined {
  const match = filename?.match(FILENAME_LINE_RANGE_PATTERN);
  if (!match) return undefined;

  return {
    startLine: Number(match[1]),
    endLine: Number(match[2]),
  };
}

/**
 * Escapes special HTML characters to prevent XSS inside the global custom tooltip.
 *
 * @param str The string to escape.
 * @returns The escaped HTML string.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Resolves the VS Code codicon class name for a given attachment type.
 *
 * @param type The type of attachment ('file', 'image', 'text', 'code-selection', 'terminal').
 * @param mime The optional MIME type of the file.
 * @returns The codicon class name.
 */
export const getIconClass = (type: string, mime?: string): string => {
  if (type === 'image') return 'file-media';
  if (type === 'text') return 'note';
  if (type === 'terminal') return 'terminal';
  if (type === 'command') return 'symbol-method';
  if (type === 'skill') return 'lightbulb';
  if (mime === 'directory' || mime === 'application/x-directory') return 'folder';
  if (mime?.startsWith('image/')) return 'file-media';
  if (mime?.startsWith('text/')) return 'file-text';
  if (mime === 'application/pdf') return 'file-pdf';
  return 'file';
};

/**
 * Resolves the codicon class for a command chip based on its source type.
 */
export function getCommandIconClass(source?: string): string {
  switch (source) {
    case 'skill':
      return 'lightbulb';
    case 'mcp':
      return 'server-process';
    case 'command':
    default:
      return 'symbol-method';
  }
}

/**
 * Formats and generates the HTML string for the global custom tooltip engine.
 *
 * @param chip The chip metadata.
 * @param fileInfos The current session file cache.
 * @returns The generated HTML string.
 */
export const getTooltipHtml = (
  chip: {
    type: 'file' | 'image' | 'text' | 'code-selection' | 'terminal' | 'command' | 'skill';
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
  },
  fileInfos: Record<
    string,
    { exists: boolean; size: number; content?: string; isWorkspace: boolean }
  >,
): string => {
  const { type, filename, path, text, size, dataUrl, linesCount, mime, startLine, endLine } = chip;

  if (type === 'command') {
    return `<div class="tooltip-container">
      <strong>Command: ${escapeHtml(filename || 'command')}</strong><br/>
      <span class="tooltip-meta">Type parameters after the chip and press Enter to execute</span>
    </div>`;
  }

  if (type === 'skill') {
    return `<div class="tooltip-container">
      <strong>Skill: ${escapeHtml(filename || 'skill')}</strong><br/>
      ${text ? `<pre class="tooltip-code">${escapeHtml(text)}</pre>` : ''}
    </div>`;
  }

  if (type === 'code-selection') {
    let cleanFilename = filename || 'file';
    if (FILENAME_LINE_RANGE_PATTERN.test(cleanFilename)) {
      cleanFilename = cleanFilename.replace(FILENAME_LINE_RANGE_PATTERN, '');
    }
    return `<div class="tooltip-container">
      <strong>Selected Code Snippet</strong> (${escapeHtml(cleanFilename)} [${startLine || 1}-${endLine || 1}])<br/>
      ${path ? `<span class="tooltip-meta">Path: ${escapeHtml(path)}</span><br/>` : ''}
      <pre class="tooltip-code">${escapeHtml(text || '')}</pre>
    </div>`;
  }

  if (type === 'terminal') {
    return `<div class="tooltip-container">
      <strong>Terminal Output</strong> (${linesCount || 1} lines)
      <pre class="tooltip-code">${escapeHtml(text || '')}</pre>
    </div>`;
  }

  if (mime === 'directory' || mime === 'application/x-directory') {
    const displayPath = path || '';
    return `<div class="tooltip-container">
      <strong>${escapeHtml(filename || 'Directory')}</strong><br/>
      ${path ? `<span class="tooltip-meta">Directory Path: ${escapeHtml(displayPath)}</span><br/>` : ''}
      <div class="tooltip-meta">Workspace Folder</div>
    </div>`;
  }

  if (type === 'image') {
    const src = dataUrl || path || '';
    return `<div class="tooltip-container">
      <strong>${escapeHtml(filename || 'Pasted Image')}</strong>
      ${src ? `<img src="${src}" class="tooltip-img" />` : '<div class="tooltip-error">No image data</div>'}
    </div>`;
  }

  if (type === 'text') {
    const lines = linesCount || text?.split('\n').length || 1;
    return `<div class="tooltip-container">
      <strong>Pasted Text Snippet</strong> (${lines} lines)
      <pre class="tooltip-code">${escapeHtml(text || '')}</pre>
    </div>`;
  }

  const cachedInfo = path ? fileInfos[path] : undefined;
  const resolvedInfo = cachedInfo || {
    exists: false,
    size: size || 0,
    content: text,
    isWorkspace: chip.isWorkspace || false,
  };
  const displayPath = path || '';
  const displaySize = resolvedInfo.size ? `${(resolvedInfo.size / 1024).toFixed(1)} KB` : '0 KB';

  let contentHtml: string;
  if (resolvedInfo.exists || text) {
    const fileContent = resolvedInfo.content !== undefined ? resolvedInfo.content : text;
    if (fileContent !== undefined) {
      contentHtml = `<pre class="tooltip-code">${escapeHtml(fileContent)}</pre>`;
    } else {
      contentHtml = `<div class="tooltip-meta">Preview unavailable (binary or &gt;30KB)</div>`;
    }
  } else {
    contentHtml = `<div class="tooltip-error">Querying file contents...</div>`;
  }

  return `<div class="tooltip-container">
    <strong>${escapeHtml(filename || 'file')}</strong><br/>
    ${path ? `<span class="tooltip-meta">Path: ${escapeHtml(displayPath)}</span><br/>` : ''}
    <span class="tooltip-meta">Size: ${displaySize}</span>
    ${contentHtml}
  </div>`;
};

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
            let cleanPath = path.replace(/\\/g, '/');
            if (!cleanPath.startsWith('/')) {
              cleanPath = '/' + cleanPath;
            }
            finalUrl = `file://${cleanPath}`;
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
            let cleanPath = path.replace(/\\/g, '/');
            if (!cleanPath.startsWith('/')) {
              cleanPath = '/' + cleanPath;
            }
            finalUrl = `file://${cleanPath}`;
          } else {
            const fileContent = chipText || cached?.content || '';
            const MAX_DATA_URL_LIMIT = 50 * 1024;
            const truncatedText =
              fileContent.length > MAX_DATA_URL_LIMIT
                ? fileContent.slice(0, MAX_DATA_URL_LIMIT) + '\n... (truncated due to size limit)'
                : fileContent;
            const base64Content = btoa(unescape(encodeURIComponent(truncatedText)));
            finalUrl = `data:${mime || 'text/plain'};base64,${base64Content}`;
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

/** Parsed result of a file URL containing decoded path and text content. */
export interface ParsedFileUrl {
  path?: string;
  text?: string;
}

/**
 * Parses file:// or data: URIs and returns the resolved file path and/or decoded text content.
 *
 * @param url The raw URL string.
 * @param mime The optional MIME type to identify text-decodable data URLs.
 * @returns An object containing path and text.
 */
export function parseFileUrl(url: string, mime?: string): ParsedFileUrl {
  let path: string | undefined;
  let text: string | undefined;

  if (url.startsWith('file://')) {
    try {
      const parsedUrl = new URL(url);
      let resolvedPath = decodeURIComponent(parsedUrl.pathname);
      if (resolvedPath.match(/^\/[a-zA-Z]:/)) {
        resolvedPath = resolvedPath.substring(1);
      }
      path = resolvedPath;
    } catch {
      path = decodeURIComponent(url.substring(7));
    }
  } else if (url.startsWith('data:')) {
    try {
      const commaIndex = url.indexOf(',');
      if (commaIndex !== -1) {
        const meta = url.substring(0, commaIndex);
        const base64Data = url.substring(commaIndex + 1);
        if (meta.includes(';base64') && (meta.includes('text/') || mime?.startsWith('text/'))) {
          text = decodeURIComponent(escape(atob(base64Data)));
        }
      }
    } catch {
      // ignore decoding errors
    }
  } else {
    path = url;
  }

  return { path, text };
}
