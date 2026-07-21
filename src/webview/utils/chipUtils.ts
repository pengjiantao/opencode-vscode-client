/**
 * @file Utility helpers for parsing, formatting, and serializing inline attachment chips.
 */

import React from 'react';
import { FILENAME_LINE_RANGE_PATTERN } from '../../shared/utils';
import { Markdown } from '../components/Markdown';

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
 * Metadata accepted by the chip tooltip renderer.
 */
export interface ChipTooltipData {
  /** The attachment type represented by the chip. */
  type: 'file' | 'image' | 'text' | 'code-selection' | 'terminal' | 'command' | 'skill';
  /** Display filename or chip label. */
  filename?: string;
  /** Absolute file path or image source. */
  path?: string;
  /** Direct text content. */
  text?: string;
  /** Attachment size in bytes. */
  size?: number;
  /** Attachment MIME type. */
  mime?: string;
  /** Whether the attachment is within the active workspace. */
  isWorkspace?: boolean;
  /** Image data URL. */
  dataUrl?: string;
  /** Number of content lines. */
  linesCount?: number;
  /** One-based starting line for selections. */
  startLine?: number;
  /** One-based ending line for selections. */
  endLine?: number;
}

/**
 * Formats and generates React content for the global custom tooltip engine.
 * Skill descriptions use the shared Markdown component; other chip previews preserve their source text.
 *
 * @param chip The chip metadata.
 * @param fileInfos The current session file cache.
 * @returns The generated React tooltip content.
 */
export const getTooltipContent = (
  chip: ChipTooltipData,
  fileInfos: Record<
    string,
    { exists: boolean; size: number; content?: string; isWorkspace: boolean }
  >,
): React.ReactNode => {
  const { type, filename, path, text, size, dataUrl, mime } = chip;

  if (type === 'command') {
    return React.createElement(
      'div',
      { className: 'tooltip-container' },
      React.createElement('strong', null, `Command: ${filename || 'command'}`),
      React.createElement(
        'span',
        { className: 'tooltip-meta' },
        'Type parameters after the chip and press Enter to execute',
      ),
    );
  }

  if (type === 'skill') {
    return React.createElement(
      'div',
      { className: 'tooltip-container' },
      React.createElement('strong', null, `Skill: ${filename || 'skill'}`),
      text
        ? React.createElement(
            'div',
            { className: 'tooltip-markdown-content' },
            React.createElement(Markdown, { text }),
          )
        : null,
    );
  }

  if (type === 'code-selection') {
    return React.createElement('div', { className: 'tooltip-text-direct' }, text || '');
  }

  if (type === 'terminal') {
    return React.createElement('div', { className: 'tooltip-text-direct' }, text || '');
  }

  if (mime === 'directory' || mime === 'application/x-directory') {
    const displayPath = path || '';
    return React.createElement(
      'div',
      { className: 'tooltip-container' },
      React.createElement('strong', null, filename || 'Directory'),
      path
        ? React.createElement(
            'span',
            { className: 'tooltip-meta' },
            `Directory Path: ${displayPath}`,
          )
        : null,
      React.createElement('div', { className: 'tooltip-meta' }, 'Workspace Folder'),
    );
  }

  if (type === 'image') {
    const src = dataUrl || path || '';
    return React.createElement(
      'div',
      { className: 'tooltip-container' },
      React.createElement('strong', null, filename || 'Pasted Image'),
      src
        ? React.createElement('img', {
            src,
            className: 'tooltip-img',
            alt: filename || 'Pasted image preview',
          })
        : React.createElement('div', { className: 'tooltip-error' }, 'No image data'),
    );
  }

  if (type === 'text') {
    return React.createElement('div', { className: 'tooltip-text-direct' }, text || '');
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
      return React.createElement('div', { className: 'tooltip-text-direct' }, fileContent);
    } else {
      return React.createElement(
        'div',
        { className: 'tooltip-meta' },
        'Preview unavailable (binary or >30KB)',
      );
    }
  } else {
    return React.createElement('div', { className: 'tooltip-error' }, 'Querying file contents...');
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
