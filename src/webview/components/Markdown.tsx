/**
 * @file Robust, lightweight, streaming-safe Markdown component with professional PrismJS code syntax highlighting.
 * Renders bold, italic, code blocks, lists, headings, and inline code natively.
 * Also parses and renders custom inline attachment chips.
 */

import type { Part } from '@opencode-ai/sdk/v2/client';
import React from 'react';
import { parseAndRenderInlineChip } from '../utils/markdownChipRenderer';
import { isSeparatorLine, parseAlignments, parseTableRow } from '../utils/markdownTableParser';
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
    /(\*\*(.*?)\*\*)|(\*(.*?)\*)|(`(.*?)`)|(\[(.*?)\]\((.*?)\))|(\[(Code Selection):\s*(.*?)\]\])|(\[(File|Text|Image|Terminal):\s*(.*?)\])/g;
  let match;
  let lastIndex = 0;
  let keyIdx = 0;

  // Pre-index parts for O(1) lookups to avoid nested linear searches
  const partsByFilename = new Map<string, Part>();
  const partsByTextFilename = new Map<string, Part>();
  const partsByImageFilename = new Map<string, Part>();
  const partsByTerminalFilename = new Map<string, Part>();

  if (allParts) {
    for (const p of allParts) {
      if (p.type === 'file' && p.filename) {
        partsByFilename.set(p.filename, p);
        if (p.mime?.startsWith('image/') || p.url?.startsWith('data:image/')) {
          partsByImageFilename.set(p.filename, p);
        }
        if (
          p.filename.startsWith('terminal [') ||
          (p.source &&
            (p.source.type === 'file' || p.source.type === 'symbol') &&
            p.source.path.startsWith('terminal-'))
        ) {
          partsByTerminalFilename.set(p.filename, p);
        }
      } else if (p.type === 'text') {
        const meta = p.metadata as { type?: string; filename?: string } | undefined;
        if (meta?.type === 'pasted-text' && meta?.filename) {
          partsByTextFilename.set(meta.filename, p);
        }
      }
    }
  }

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
      codeSelectionFull,
      codeSelectionType,
      codeSelectionName,
      otherChipFull,
      otherChipType,
      otherChipName,
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
    } else {
      let chipFull: string | undefined;
      let chipType: string | undefined;
      let chipName: string | undefined;

      if (codeSelectionFull) {
        chipFull = codeSelectionFull;
        chipType = codeSelectionType;
        chipName = codeSelectionName + ']';
      } else if (otherChipFull) {
        chipFull = otherChipFull;
        chipType = otherChipType;
        chipName = otherChipName;
      }

      if (chipFull && chipType && chipName) {
        const key = keyIdx++;
        const chipElement = parseAndRenderInlineChip(
          chipType,
          chipName,
          partsByFilename,
          partsByTextFilename,
          partsByImageFilename,
          partsByTerminalFilename,
          key,
        );
        if (chipElement) {
          parts.push(chipElement);
        } else {
          parts.push(chipFull);
        }
      }
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
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
