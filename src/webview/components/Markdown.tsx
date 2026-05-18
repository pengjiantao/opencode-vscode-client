/**
 * @file Robust, lightweight, streaming-safe Markdown component with professional PrismJS code syntax highlighting.
 * Renders bold, italic, code blocks, lists, headings, and inline code natively.
 */

import Prism from 'prismjs';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-typescript';
import React from 'react';
import { IconButton } from './IconButton';

interface MarkdownProps {
  /** The markdown text to parse and render. */
  text: string;
}

/** Recursively renders a PrismJS token or string to React nodes. */
function renderToken(token: string | Prism.Token, key: string): React.ReactNode {
  if (typeof token === 'string') {
    return token;
  }
  const type = token.type;
  const content = token.content;

  let children: React.ReactNode;
  if (Array.isArray(content)) {
    children = content.map((child, idx) => renderToken(child, `${key}-${idx}`));
  } else if (typeof content === 'object') {
    children = renderToken(content, `${key}-sub`);
  } else {
    children = content;
  }

  const alias = Array.isArray(token.alias) ? token.alias.join(' ') : token.alias || '';
  const className = `token ${type} ${alias}`;
  return (
    <span key={key} className={className.trim()}>
      {children}
    </span>
  );
}

/** Generates React nodes with syntax highlight classes for the provided code block using PrismJS. */
function highlightCode(code: string, lang = ''): React.ReactNode {
  const language = lang.toLowerCase();
  let grammar = Prism.languages.clike; // default fallback

  if (language === 'typescript' || language === 'ts') {
    grammar = Prism.languages.typescript || Prism.languages.javascript;
  } else if (language === 'javascript' || language === 'js') {
    grammar = Prism.languages.javascript;
  } else if (language === 'python' || language === 'py') {
    grammar = Prism.languages.python;
  } else if (language === 'bash' || language === 'sh' || language === 'shell') {
    grammar = Prism.languages.bash;
  } else if (language === 'json') {
    grammar = Prism.languages.json;
  } else if (language === 'css') {
    grammar = Prism.languages.css;
  } else if (language === 'go') {
    grammar = Prism.languages.go;
  } else if (language === 'rust') {
    grammar = Prism.languages.rust;
  } else if (language === 'html' || language === 'xml' || language === 'svg') {
    grammar = Prism.languages.markup;
  }

  const tokens = Prism.tokenize(code, grammar);
  return tokens.map((token, idx) => renderToken(token, `prism-${idx}`));
}

interface CodeBlockProps {
  /** The language of the code block (e.g., 'typescript', 'bash'). */
  lang: string;
  /** The raw code content. */
  code: string;
}

/** Renders a syntax-highlighted code block with an independent copy button and tooltip feedback. */
function CodeBlock({ lang, code }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => {
        setCopied(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const highlighted = React.useMemo(() => highlightCode(code, lang), [code, lang]);

  const handleCopy = () => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
  };

  return (
    <div className="code-block-container">
      <div className="code-block-header">
        <span className="code-lang">{lang || 'code'}</span>
        <IconButton
          name={copied ? '$(check)' : '$(copy)'}
          onClick={handleCopy}
          title={copied ? 'Copied!' : 'Copy Code'}
          size="small"
          className="copy-code-btn"
        />
      </div>
      <pre className="code-block">
        <code>{highlighted}</code>
      </pre>
    </div>
  );
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
        elements.push(<CodeBlock key={`code-${elements.length}`} lang={lang} code={code} />);
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
    elements.push(<CodeBlock key={`code-${elements.length}`} lang={lang} code={code} />);
  }

  flushParagraph();
  flushList();

  return <div className="markdown-body">{elements}</div>;
}
