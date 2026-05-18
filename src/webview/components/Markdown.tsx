/**
 * @file Robust, lightweight, streaming-safe Markdown component with code syntax highlighting.
 * Renders bold, italic, code blocks, lists, headings, and inline code natively.
 */

import React from 'react';

interface MarkdownProps {
  text: string;
}

/** Regex tokenizer for code syntax highlighting. */
const tokenRegex = new RegExp(
  '(?<comment>\\/\\/.*|\\/\\*[\\s\\S]*?\\*\\/)|' +
    '(?<string>\'(?:\\\\.|[^\'\\\\])*\'|"(?:\\\\.|[^"\\\\])*"|`(?:\\\\.|[^`\\\\])*`)|' +
    '(?<keyword>\\b(?:const|let|var|function|class|import|export|from|return|if|else|for|while|switch|case|default|break|continue|try|catch|finally|throw|new|this|interface|type|extends|implements|public|private|protected|static|readonly|as|any|string|number|boolean|void|true|false|null|undefined)\\b)|' +
    '(?<number>\\b\\d+(?:\\.\\d+)?\\b)|' +
    '(?<fn>\\b[a-zA-Z_]\\w*(?=\\s*\\())|' +
    '(?<operator>[+\\-*\\/%&|^!~=<>:?]+)',
  'g',
);

/** Generates React nodes with syntax highlight classes for the provided code block. */
function highlightCode(code: string): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  let match;
  let lastIndex = 0;
  let keyIdx = 0;

  // Reset regex index
  tokenRegex.lastIndex = 0;

  while ((match = tokenRegex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(code.substring(lastIndex, match.index));
    }

    const groups = match.groups || {};
    if (groups.comment) {
      nodes.push(
        <span key={`comment-${keyIdx++}`} className="token comment">
          {groups.comment}
        </span>,
      );
    } else if (groups.string) {
      nodes.push(
        <span key={`string-${keyIdx++}`} className="token string">
          {groups.string}
        </span>,
      );
    } else if (groups.keyword) {
      nodes.push(
        <span key={`keyword-${keyIdx++}`} className="token keyword">
          {groups.keyword}
        </span>,
      );
    } else if (groups.number) {
      nodes.push(
        <span key={`number-${keyIdx++}`} className="token number">
          {groups.number}
        </span>,
      );
    } else if (groups.fn) {
      nodes.push(
        <span key={`fn-${keyIdx++}`} className="token function">
          {groups.fn}
        </span>,
      );
    } else if (groups.operator) {
      nodes.push(
        <span key={`operator-${keyIdx++}`} className="token operator">
          {groups.operator}
        </span>,
      );
    } else {
      nodes.push(match[0]);
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < code.length) {
    nodes.push(code.substring(lastIndex));
  }

  return nodes.length > 0 ? nodes : code;
}

/** Parses inline markdown markup (bold, italic, inline code, and links). */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.*?)\*\*)|(\*(.*?)\*)|(`(.*?)`)|(\[(.*?)\]\((.*?)\))/g;
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
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}

/** Renders standard markdown document elements (headers, lists, block codes, paragraphs). */
export function Markdown({ text }: MarkdownProps) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentCodeBlock: { lang: string; lines: string[] } | null = null;
  let currentList: { ordered: boolean; items: React.ReactNode[][] } | null = null;
  let currentParagraphLines: string[] = [];

  const flushParagraph = () => {
    if (currentParagraphLines.length > 0) {
      const pText = currentParagraphLines.join(' ');
      elements.push(<p key={`p-${elements.length}`}>{renderInline(pText)}</p>);
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block boundary
    if (line.trim().startsWith('```')) {
      if (currentCodeBlock) {
        const code = currentCodeBlock.lines.join('\n');
        const lang = currentCodeBlock.lang;
        elements.push(
          <div key={`code-${elements.length}`} className="code-block-container">
            <div className="code-block-header">
              <span className="code-lang">{lang || 'code'}</span>
              <button
                className="copy-code-btn"
                onClick={() => {
                  void navigator.clipboard.writeText(code);
                }}
                data-custom-title="Copy Code"
              >
                Copy
              </button>
            </div>
            <pre className="code-block">
              <code>{highlightCode(code)}</code>
            </pre>
          </div>,
        );
        currentCodeBlock = null;
      } else {
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

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
      elements.push(
        <HeadingTag key={`h-${elements.length}`}>{renderInline(headingMatch[2])}</HeadingTag>,
      );
      continue;
    }

    // Lists
    const unorderedMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
    const orderedMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    const listMatch = unorderedMatch || orderedMatch;

    if (listMatch) {
      flushParagraph();
      const isOrdered = !!orderedMatch;
      const content = listMatch[2];

      if (!currentList || currentList.ordered !== isOrdered) {
        flushList();
        currentList = { ordered: isOrdered, items: [] };
      }
      currentList.items.push(renderInline(content));
      continue;
    }

    // Empty line ends list or paragraph
    if (line.trim() === '') {
      flushParagraph();
      flushList();
      continue;
    }

    // Plain text
    flushList();
    currentParagraphLines.push(line.trim());
  }

  // Handle unclosed blocks gracefully
  if (currentCodeBlock) {
    const code = currentCodeBlock.lines.join('\n');
    const lang = currentCodeBlock.lang;
    elements.push(
      <div key={`code-${elements.length}`} className="code-block-container">
        <div className="code-block-header">
          <span className="code-lang">{lang || 'code'}</span>
          <button
            className="copy-code-btn"
            onClick={() => {
              void navigator.clipboard.writeText(code);
            }}
          >
            Copy
          </button>
        </div>
        <pre className="code-block">
          <code>{highlightCode(code)}</code>
        </pre>
      </div>,
    );
  }

  flushParagraph();
  flushList();

  return <div className="markdown-body">{elements}</div>;
}
