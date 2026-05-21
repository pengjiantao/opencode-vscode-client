/**
 * @file Utility helpers for parsing, formatting, and serializing inline attachment chips.
 */

import { FILENAME_LINE_RANGE_PATTERN } from '../../shared/utils';

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
 * Simple markdown parser to convert markdown string to HTML string for tooltips.
 * Supports headers (# to ######), unordered lists, bold (**), italics (*), inline code (`), and links.
 *
 * @param markdown The raw markdown string to parse.
 * @returns The parsed HTML string.
 */
export function parseMarkdownToHtml(markdown: string): string {
  const lines = markdown.split('\n');
  const htmlLines: string[] = [];
  let inList = false;
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle code blocks (e.g. ```javascript ... ```)
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        htmlLines.push('</code></pre>');
        inCodeBlock = false;
      } else {
        htmlLines.push('<pre class="tooltip-markdown-code"><code>');
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      htmlLines.push(escapeHtml(line) + '\n');
      continue;
    }

    // Handle headers (# to ######)
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      if (inList) {
        htmlLines.push('</ul>');
        inList = false;
      }
      const level = headingMatch[1].length;
      const text = parseInlineMarkdown(headingMatch[2]);
      htmlLines.push(`<h${level} class="tooltip-markdown-h${level}">${text}</h${level}>`);
      continue;
    }

    // Handle lists starting with -, *, or +
    const listMatch = line.match(/^[-*+]\s+(.*)$/);
    if (listMatch) {
      if (!inList) {
        htmlLines.push('<ul class="tooltip-markdown-list">');
        inList = true;
      }
      const text = parseInlineMarkdown(listMatch[1]);
      htmlLines.push(`<li>${text}</li>`);
      continue;
    }

    // Close active list if empty line or non-list line is encountered
    if (inList && line.trim() === '') {
      htmlLines.push('</ul>');
      inList = false;
      continue;
    }

    // Normal paragraph rendering
    if (line.trim() !== '') {
      if (inList) {
        htmlLines.push('</ul>');
        inList = false;
      }
      const text = parseInlineMarkdown(line);
      htmlLines.push(`<p class="tooltip-markdown-p">${text}</p>`);
    } else {
      if (inList) {
        htmlLines.push('</ul>');
        inList = false;
      }
    }
  }

  // Gracefully close any unclosed lists or code blocks
  if (inList) {
    htmlLines.push('</ul>');
  }
  if (inCodeBlock) {
    htmlLines.push('</code></pre>');
  }

  return htmlLines.join('');
}

/**
 * Parses inline markdown markup like bold, italic, inline code, and links.
 * Escapes input text first to prevent cross-site scripting (XSS) issues.
 *
 * @param text The plain text line to parse.
 * @returns The HTML string with inline markup tags.
 */
function parseInlineMarkdown(text: string): string {
  let escaped = escapeHtml(text);
  // Bold-italic: ***text***
  escaped = escaped.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Bold: **text**
  escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic: *text*
  escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Inline code: `code`
  escaped = escaped.replace(/`(.*?)`/g, '<code class="tooltip-markdown-inline-code">$1</code>');
  // Links: [text](url) with safe protocol check (only http:, https:, mailto:)
  escaped = escaped.replace(
    /\[(.*?)\]\((.*?)\)/g,
    (match: string, textPart: string, urlPart: string): string => {
      const trimmedUrl = urlPart.trim().toLowerCase();
      const isSafe =
        trimmedUrl.startsWith('http://') ||
        trimmedUrl.startsWith('https://') ||
        trimmedUrl.startsWith('mailto:');
      if (isSafe) {
        return `<a href="${urlPart}" target="_blank" rel="noopener noreferrer" class="markdown-link">${textPart}</a>`;
      }
      return textPart;
    },
  );
  return escaped;
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
  const { type, filename, path, text, size, dataUrl, mime } = chip;

  if (type === 'command') {
    return `<div class="tooltip-container">
      <strong>Command: ${escapeHtml(filename || 'command')}</strong><br/>
      <span class="tooltip-meta">Type parameters after the chip and press Enter to execute</span>
    </div>`;
  }

  if (type === 'skill') {
    return `<div class="tooltip-container">
      <strong>Skill: ${escapeHtml(filename || 'skill')}</strong><br/>
      ${text ? `<div class="tooltip-markdown-content">${parseMarkdownToHtml(text)}</div>` : ''}
    </div>`;
  }

  if (type === 'code-selection') {
    return `<div class="tooltip-text-direct">${escapeHtml(text || '')}</div>`;
  }

  if (type === 'terminal') {
    return `<div class="tooltip-text-direct">${escapeHtml(text || '')}</div>`;
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
    return `<div class="tooltip-text-direct">${escapeHtml(text || '')}</div>`;
  }

  const cachedInfo = path ? fileInfos[path] : undefined;
  const resolvedInfo = cachedInfo || {
    exists: false,
    size: size || 0,
    content: text,
    isWorkspace: chip.isWorkspace || false,
  };

  if (resolvedInfo.exists || text) {
    const fileContent = resolvedInfo.content !== undefined ? resolvedInfo.content : text;
    if (fileContent !== undefined) {
      return `<div class="tooltip-text-direct">${escapeHtml(fileContent)}</div>`;
    } else {
      return `<div class="tooltip-meta">Preview unavailable (binary or &gt;30KB)</div>`;
    }
  } else {
    return `<div class="tooltip-error">Querying file contents...</div>`;
  }
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

/**
 * Truncates a string in the middle if its length exceeds maxLength, preserving the start and end.
 *
 * @param str The string to truncate.
 * @param maxLength The maximum allowed length before truncation occurs.
 * @returns The truncated string with ellipsis in the middle, or the original string.
 */
export function truncateMiddle(str: string, maxLength: number = 32): string {
  if (!str || str.length <= maxLength) return str;
  const ellipsis = '...';
  // Compute lengths for prefix and suffix segments so that total length equals maxLength
  const prefixLength = Math.ceil((maxLength - ellipsis.length) / 2);
  const suffixLength = Math.floor((maxLength - ellipsis.length) / 2);
  return str.slice(0, prefixLength) + ellipsis + str.slice(str.length - suffixLength);
}

/**
 * Returns the optimized, truncated display label for a chip based on its type and filename.
 * Guarantees that essential suffixes like line ranges and file extensions are preserved.
 *
 * @param type The chip's target attachment type.
 * @param filename Optional name of the file, image, command, or skill.
 * @param linesCount Optional lines count for pasted text or terminal logs.
 * @param startLine Optional starting line number for code selection.
 * @param endLine Optional ending line number for code selection.
 * @param text Optional text body used for fallback line count calculation.
 * @returns The formatted and optionally middle-truncated display label.
 */
export function getChipDisplayLabel(
  type: 'file' | 'image' | 'text' | 'code-selection' | 'terminal' | 'command' | 'skill',
  filename?: string,
  linesCount?: number,
  startLine?: number,
  endLine?: number,
  text?: string,
): string {
  if (type === 'file' || type === 'image') {
    return truncateMiddle(filename || 'file', 32);
  }
  if (type === 'text') {
    return `Pasted ${linesCount || text?.split('\n').length || 1} Lines`;
  }
  if (type === 'code-selection') {
    let cleanFilename = filename || 'file';
    const match = cleanFilename.match(/\s*\[(\d+)-(\d+)\]$/);
    let rangeStr: string;
    if (match) {
      cleanFilename = cleanFilename.replace(/\s*\[(\d+)-(\d+)\]$/, '');
      rangeStr = ` [${match[1]}-${match[2]}]`;
    } else {
      rangeStr = ` [${startLine || 1}-${endLine || 1}]`;
    }
    // Truncate the filename portion specifically to preserve the line range suffix intact
    return truncateMiddle(cleanFilename, 24) + rangeStr;
  }
  if (type === 'terminal') {
    if (filename && /terminal\s*\[\d+/.test(filename)) {
      return filename;
    }
    return `terminal[${linesCount || 1} lines]`;
  }
  if (type === 'command') {
    return truncateMiddle(filename || 'command', 32);
  }
  if (type === 'skill') {
    return truncateMiddle(filename || 'skill', 32);
  }
  return truncateMiddle(filename || 'chip', 32);
}
