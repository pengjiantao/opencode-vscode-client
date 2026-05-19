/**
 * @file Reusable, high-performance code block component with PrismJS syntax highlighting and copy-to-clipboard support.
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

/** Props accepted by the CodeBlock component. */
export interface CodeBlockProps {
  /** The language of the code block (e.g., 'typescript', 'bash'). */
  lang: string;
  /** The raw code content. */
  code: string;
}

/**
 * Renders a syntax-highlighted code block with an independent copy button and tooltip feedback.
 *
 * @param props - The properties for the CodeBlock component.
 * @returns The rendered React node for the syntax-highlighted code block.
 */
export function CodeBlock({ lang, code }: CodeBlockProps): React.JSX.Element {
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
