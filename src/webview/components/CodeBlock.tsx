/**
 * @file Reusable, high-performance code block component with PrismJS syntax highlighting and copy-to-clipboard support.
 */

import Prism from 'prismjs';
import React from 'react';
import { resolvePrismLanguage, type PrismLanguageResolution } from '../utils/prismLanguageRegistry';
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
function highlightCode(code: string, language: PrismLanguageResolution): React.ReactNode {
  if (!language.grammar) {
    return code;
  }

  const tokens = Prism.tokenize(code, language.grammar);
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

  const language = React.useMemo(() => resolvePrismLanguage(lang), [lang]);
  const highlighted = React.useMemo(() => highlightCode(code, language), [code, language]);

  const handleCopy = () => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
  };

  return (
    <div className="code-block-container">
      <div className="code-block-header">
        <span className="code-lang">{language.displayName}</span>
        <IconButton
          name={copied ? '$(check)' : '$(copy)'}
          onClick={handleCopy}
          title={copied ? 'Copied!' : 'Copy Code'}
          size="small"
          className="copy-code-btn"
        />
      </div>
      <pre className="code-block">
        <code className={`language-${language.languageId}`}>{highlighted}</code>
      </pre>
    </div>
  );
}
