/**
 * @file Robust, lightweight, streaming-safe Markdown component with professional PrismJS code syntax highlighting.
 * Renders bold, italic, code blocks, lists, headings, and inline code natively.
 * Also parses and renders custom inline attachment chips.
 */

import type { Part } from '@opencode-ai/sdk/v2/client';
import React from 'react';
import { parseFileUrl } from '../utils/chipUtils';
import { Chip } from './Chip';
import { CodeBlock } from './CodeBlock';

interface MarkdownProps {
  /** The markdown text to parse and render. */
  text: string;
  /** Optional message parts for resolving inline attachment chips. */
  allParts?: Part[];
}

/** Parses inline markdown markup (bold, italic, inline code, links, and inline chips). */
function renderInline(text: string, allParts?: Part[]): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex =
    /(\*\*(.*?)\*\*)|(\*(.*?)\*)|(`(.*?)`)|(\[(.*?)\]\((.*?)\))|(\[(File|Text|Image):\s*(.*?)\])/g;
  let match;
  let lastIndex = 0;
  let keyIdx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const [
      ,
      boldFull,
      boldInner,
      italicFull,
      italicInner,
      codeFull,
      codeInner,
      linkFull,
      linkText,
      linkUrl,
      chipFull,
      chipType,
      chipName,
    ] = match;

    if (boldFull) {
      parts.push(<strong key={`bold-${keyIdx++}`}>{boldInner}</strong>);
    } else if (italicFull) {
      parts.push(<em key={`italic-${keyIdx++}`}>{italicInner}</em>);
    } else if (codeFull) {
      parts.push(<code key={`code-${keyIdx++}`}>{codeInner}</code>);
    } else if (linkFull) {
      parts.push(
        <a
          key={`link-${keyIdx++}`}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="markdown-link"
        >
          {linkText}
        </a>,
      );
    } else if (chipFull) {
      const matchedPart = allParts?.find((p) => {
        if (chipType === 'File') {
          return p.type === 'file' && p.filename === chipName;
        } else if (chipType === 'Text') {
          return (
            p.type === 'text' &&
            p.metadata?.type === 'pasted-text' &&
            p.metadata?.filename === chipName
          );
        } else if (chipType === 'Image') {
          return (
            p.type === 'file' &&
            p.filename === chipName &&
            (p.mime?.startsWith('image/') || p.url?.startsWith('data:image/'))
          );
        }
        return false;
      });

      let rendered = false;
      if (matchedPart) {
        if (chipType === 'Text' && matchedPart.type === 'text') {
          rendered = true;
          const meta = matchedPart.metadata as
            | { filename?: string; linesCount?: number }
            | undefined;
          parts.push(
            <span
              key={`chip-${keyIdx++}`}
              className="opencode-chip-inline-wrapper"
              style={{ display: 'inline-block', verticalAlign: 'middle', margin: '0 2px' }}
            >
              <Chip
                type="text"
                filename={meta?.filename || chipName}
                text={matchedPart.text}
                linesCount={meta?.linesCount}
              />
            </span>,
          );
        } else if (matchedPart.type === 'file') {
          rendered = true;
          const isImage =
            chipType === 'Image' ||
            matchedPart.mime?.startsWith('image/') ||
            matchedPart.url?.startsWith('data:image/');
          const sourcePath =
            matchedPart.source &&
            (matchedPart.source.type === 'file' || matchedPart.source.type === 'symbol')
              ? matchedPart.source.path
              : undefined;
          let resolvedPath: string | undefined = sourcePath;
          let decodedText: string | undefined;
          const url = matchedPart.url;

          if (!isImage && url) {
            const parsed = parseFileUrl(url, matchedPart.mime);
            resolvedPath = resolvedPath || parsed.path;
            decodedText = parsed.text;
          }

          parts.push(
            <span
              key={`chip-${keyIdx++}`}
              className="opencode-chip-inline-wrapper"
              style={{ display: 'inline-block', verticalAlign: 'middle', margin: '0 2px' }}
            >
              <Chip
                type={isImage ? 'image' : 'file'}
                filename={matchedPart.filename}
                path={resolvedPath}
                mime={matchedPart.mime}
                dataUrl={isImage ? url : undefined}
                text={decodedText}
              />
            </span>,
          );
        }
      }
      if (!rendered) {
        parts.push(chipFull);
      }
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}

/**
 * Checks if a markdown line acts as a table separator/alignment row (e.g., `|:---:|---:|`).
 *
 * Separator lines are composed solely of pipes, dashes, colons, and whitespace.
 * Requiring at least one dash per column avoids false positives with normal text pipes.
 *
 * @param line - The raw string line to analyze.
 * @returns True if the line matches the GFM table separator row format.
 */
function isSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  // A table separator must start and end with pipes in our parser
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
    return false;
  }
  const inner = trimmed.slice(1, -1);
  const parts = inner.split('|');
  // Every column between the pipes must represent a valid GFM separator (only colons and dashes)
  return parts.every((part) => {
    const p = part.trim();
    return p.length > 0 && /^[:-]+$/.test(p);
  });
}

/**
 * Helper to check if a character at index `idx` in a string is escaped by a backslash.
 * An odd number of preceding backslashes means the character is escaped.
 *
 * @param str - The string to check.
 * @param idx - The index of the character to check.
 * @returns True if the character is escaped.
 */
function isCharEscaped(str: string, idx: number): boolean {
  let backslashCount = 0;
  for (let j = idx - 1; j >= 0; j--) {
    if (str[j] === '\\') {
      backslashCount++;
    } else {
      break;
    }
  }
  return backslashCount % 2 === 1;
}

/**
 * Helper to measure the length of a consecutive sequence of backtick characters.
 *
 * @param str - The string to scan.
 * @param startIdx - The starting index of the backtick sequence.
 * @returns The length of consecutive backticks.
 */
function getBacktickSeqLen(str: string, startIdx: number): number {
  let count = 0;
  for (let idx = startIdx; idx < str.length; idx++) {
    if (str[idx] === '`') {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Parses a table row, splitting cells by `|` while correctly ignoring escaped pipes `\|`.
 *
 * We iterate through the string character by character to safely handle escaped pipe
 * characters and inline backtick code spans of arbitrary lengths, ensuring they remain
 * inside cell contents rather than acting as cell borders.
 *
 * @param line - The markdown table row line to parse.
 * @returns An array of parsed cell contents, or null if the line does not start/end with pipes.
 */
function parseTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
    return null;
  }

  // Conditionally strip trailing pipe only if it is an unescaped closing border.
  // An escaped trailing pipe (e.g. `foo \|`) belongs to the final cell's content.
  const hasClosingBorder = !isCharEscaped(trimmed, trimmed.length - 1);
  const inner = hasClosingBorder ? trimmed.slice(1, -1) : trimmed.slice(1);

  const cells: string[] = [];
  let currentCell = '';
  let activeBacktickLen = 0;
  let idx = 0;

  // Character-by-character scan to handle escaped pipes and inline code spans safely
  while (idx < inner.length) {
    const char = inner[idx];

    // Toggle backtick state for unescaped backticks to ignore internal table pipes
    if (char === '`' && !isCharEscaped(inner, idx)) {
      const len = getBacktickSeqLen(inner, idx);
      if (activeBacktickLen === 0) {
        activeBacktickLen = len;
      } else if (activeBacktickLen === len) {
        activeBacktickLen = 0;
      }
      currentCell += inner.substring(idx, idx + len);
      idx += len;
      continue;
    }

    // Split the column if we find an unescaped pipe character outside of backticks
    if (char === '|' && activeBacktickLen === 0 && !isCharEscaped(inner, idx)) {
      cells.push(currentCell.trim());
      currentCell = '';
      idx++;
      continue;
    }

    currentCell += char;
    idx++;
  }
  cells.push(currentCell.trim());

  // Replace escaped pipes back to standard pipe characters for rendering
  return cells.map((cell) => cell.replace(/\\\|/g, '|'));
}

/**
 * Extracts alignments for each column from the table separator row.
 *
 * Maps `:---:` to 'center', `:---` to 'left', `---:` to 'right', and default to null.
 *
 * @param line - The separator row line.
 * @returns An array of column alignments corresponding to each table column.
 */
function parseAlignments(line: string): ('left' | 'center' | 'right' | null)[] {
  const cells = parseTableRow(line);
  if (!cells) {
    return [];
  }
  return cells.map((cell) => {
    const trimmed = cell.trim();
    const starts = trimmed.startsWith(':');
    const ends = trimmed.endsWith(':');
    if (starts && ends) {
      return 'center';
    }
    if (starts) {
      return 'left';
    }
    if (ends) {
      return 'right';
    }
    return null;
  });
}

/** Renders standard markdown document elements (headers, lists, block codes, paragraphs). */
export function Markdown({ text, allParts }: MarkdownProps) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentCodeBlock: { lang: string; lines: string[] } | null = null;
  let currentList: { ordered: boolean; items: React.ReactNode[][] } | null = null;
  let currentParagraphLines: string[] = [];
  let currentTable: {
    headers: string[];
    alignments: ('left' | 'center' | 'right' | null)[];
    rows: string[][];
  } | null = null;

  const flushParagraph = () => {
    if (currentParagraphLines.length > 0) {
      const pText = currentParagraphLines.join(' ');
      elements.push(<p key={`p-${elements.length}`}>{renderInline(pText, allParts)}</p>);
      currentParagraphLines = [];
    }
  };

  const flushList = () => {
    if (currentList) {
      const ListTag = currentList.ordered ? 'ol' : 'ul';
      elements.push(
        <ListTag key={`list-${elements.length}`}>
          {currentList.items.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ListTag>,
      );
      currentList = null;
    }
  };

  const flushTable = () => {
    if (currentTable) {
      const { headers, alignments, rows } = currentTable;
      elements.push(
        <div key={`table-wrapper-${elements.length}`} className="markdown-table-wrapper">
          <table className="markdown-table">
            <thead>
              <tr>
                {headers.map((header, idx) => {
                  const align = alignments[idx] || undefined;
                  return (
                    <th key={idx} style={{ textAlign: align }}>
                      {renderInline(header, allParts)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            {rows.length > 0 && (
              <tbody>
                {rows.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    {row.map((cell, cellIdx) => {
                      const align = alignments[cellIdx] || undefined;
                      return (
                        <td key={cellIdx} style={{ textAlign: align }}>
                          {renderInline(cell, allParts)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>,
      );
      currentTable = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block boundary
    if (line.trim().startsWith('```')) {
      if (currentCodeBlock) {
        const code = currentCodeBlock.lines.join('\n');
        const lang = currentCodeBlock.lang;
        elements.push(<CodeBlock key={`code-${elements.length}`} lang={lang} code={code} />);
        currentCodeBlock = null;
      } else {
        flushTable();
        flushParagraph();
        flushList();
        const lang = line.trim().substring(3).trim();
        currentCodeBlock = { lang, lines: [] };
      }
      continue;
    }

    if (currentCodeBlock) {
      currentCodeBlock.lines.push(line);
      continue;
    }

    // Table row accumulation inside an active table block
    if (currentTable) {
      const rowCells = parseTableRow(line);
      if (rowCells) {
        currentTable.rows.push(rowCells);
        continue;
      } else {
        // Not a table row, so flush the active table block first
        flushTable();
      }
    }

    // Table block detection (requires headers and a valid separator line immediately next)
    if (!currentTable) {
      const detectedHeaders = parseTableRow(line);
      if (detectedHeaders && i + 1 < lines.length && isSeparatorLine(lines[i + 1])) {
        flushParagraph();
        flushList();
        const alignments = parseAlignments(lines[i + 1]);
        currentTable = {
          headers: detectedHeaders,
          alignments,
          rows: [],
        };
        i++; // Skip the separator row
        continue;
      }
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushTable();
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
      elements.push(
        <HeadingTag key={`h-${elements.length}`}>
          {renderInline(headingMatch[2], allParts)}
        </HeadingTag>,
      );
      continue;
    }

    // Lists
    const unorderedMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
    const orderedMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    const listMatch = unorderedMatch || orderedMatch;

    if (listMatch) {
      flushTable();
      flushParagraph();
      const isOrdered = !!orderedMatch;
      const content = listMatch[2];

      if (!currentList || currentList.ordered !== isOrdered) {
        flushList();
        currentList = { ordered: isOrdered, items: [] };
      }
      currentList.items.push(renderInline(content, allParts));
      continue;
    }

    // Empty line ends paragraph or table, but we do not call flushList() here because
    // list items separated by empty lines (loose lists) should belong to the same list.
    if (line.trim() === '') {
      flushTable();
      flushParagraph();
      continue;
    }

    // Plain text paragraph accumulation
    flushTable();
    flushList();
    currentParagraphLines.push(line.trim());
  }

  // Handle unclosed blocks gracefully
  if (currentCodeBlock) {
    const code = currentCodeBlock.lines.join('\n');
    const lang = currentCodeBlock.lang;
    elements.push(<CodeBlock key={`code-${elements.length}`} lang={lang} code={code} />);
  }

  flushTable();
  flushParagraph();
  flushList();

  return <div className="markdown-body">{elements}</div>;
}
