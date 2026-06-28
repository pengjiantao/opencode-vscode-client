/**
 * @file Unit and regression tests for the CodeBlock component.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CodeBlock } from './CodeBlock';

function readMarkdownStyles(): string {
  return readFileSync(resolve(process.cwd(), 'src/webview/styles/markdown.css'), 'utf8');
}

function getCssRuleBody(css: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 'm').exec(css)?.[1] ?? '';
}

describe('CodeBlock Component', () => {
  it('renders code block container, header with language name, and copy button', () => {
    const code = 'const x = 42;';
    const lang = 'typescript';

    const { container } = render(<CodeBlock code={code} lang={lang} />);

    // The header keeps the author-provided fence label while syntax uses Prism grammar aliases.
    expect(screen.getByText('typescript')).toBeInTheDocument();

    // Check pre.code-block is rendered
    const codeElement = container.querySelector('pre.code-block code');
    expect(codeElement).toBeInTheDocument();
    expect(codeElement?.textContent).toContain('const');
  });

  it('handles copy button click and shows success tooltip state', () => {
    const code = 'const y = 24;';
    const lang = 'javascript';

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    });

    render(<CodeBlock code={code} lang={lang} />);

    const copyBtn = screen.getByRole('button', { name: 'Copy Code' });
    expect(copyBtn).toBeInTheDocument();

    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith(code);
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();

    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
      writable: true,
    });
  });

  it.each([
    ['tsx', 'const View = () => <Button disabled>Save</Button>;', 'language-tsx'],
    ['sql', 'SELECT * FROM users WHERE id = 1;', 'language-sql'],
    ['yaml', 'name: app\nversion: 1', 'language-yaml'],
    ['dockerfile', 'FROM node:20\nRUN npm ci', 'language-docker'],
    ['tf', 'resource "aws_s3_bucket" "bucket" {}', 'language-hcl'],
  ])(
    'regression: highlights common Prism language fence "%s"',
    (lang: string, code: string, expectedLanguageClass: string) => {
      const { container } = render(<CodeBlock code={code} lang={lang} />);
      const codeElement = container.querySelector('pre.code-block code');

      expect(codeElement).toHaveClass(expectedLanguageClass);
      expect(codeElement?.querySelector('.token')).toBeInTheDocument();
    },
  );

  it('regression: parses markdown attribute-style fence language labels', () => {
    const { container } = render(
      <CodeBlock code={'const value: string = "ok";'} lang="{.ts .numberLines}" />,
    );
    const codeElement = container.querySelector('pre.code-block code');

    expect(screen.getByText('ts')).toBeInTheDocument();
    expect(codeElement).toHaveClass('language-typescript');
    expect(codeElement?.querySelector('.token.keyword')).toBeInTheDocument();
  });

  it('regression: renders unknown code fences as plaintext instead of misleading fallback syntax', () => {
    const code = 'alpha beta gamma';
    const { container } = render(<CodeBlock code={code} lang="not-a-real-language" />);
    const codeElement = container.querySelector('pre.code-block code');

    expect(codeElement).toHaveClass('language-plaintext');
    expect(codeElement?.querySelector('.token')).not.toBeInTheDocument();
    expect(codeElement).toHaveTextContent(code);
  });

  it('regression: highlights TypeScript control-flow keywords with an accent token color', () => {
    const code = [
      '// 收集需要撤销的 patch',
      'for (const msg of messages) {',
      '  for (const part of msg.parts) {',
      '    if (part.type === "patch") patches.push(part)',
      '  }',
      '}',
      'yield* snap.revert(patches)',
    ].join('\n');

    const { container } = render(<CodeBlock code={code} lang="typescript" />);
    const keywordTexts = Array.from(container.querySelectorAll('.token.keyword')).map(
      (element) => element.textContent,
    );
    const markdownStyles = readMarkdownStyles();
    const containerRule = getCssRuleBody(markdownStyles, '.code-block-container');
    const keywordRule = getCssRuleBody(markdownStyles, '.token.keyword');

    expect(keywordTexts).toEqual(expect.arrayContaining(['for', 'const', 'of', 'if', 'yield']));
    expect(containerRule).toContain('--code-token-keyword-foreground');
    expect(containerRule).toContain('#c586c0');
    expect(keywordRule).toContain('color: var(--code-token-keyword-foreground)');
  });

  it('regression: does not reference editor syntax variables missing from VS Code webviews', () => {
    const markdownStyles = readMarkdownStyles();
    const unsupportedWebviewVariables = [
      '--vscode-editor-comment-foreground',
      '--vscode-editor-number-foreground',
      '--vscode-editor-function-foreground',
      '--vscode-debugConsole-stringForeground',
    ];

    for (const variableName of unsupportedWebviewVariables) {
      expect(markdownStyles).not.toContain(variableName);
    }
  });

  it('regression: defines theme-sensitive highlighting overrides for light theme and high contrast', () => {
    const markdownStyles = readMarkdownStyles();
    const lightRule = getCssRuleBody(markdownStyles, 'body.vscode-light .code-block-container');
    const hcRule = getCssRuleBody(
      markdownStyles,
      'body.vscode-high-contrast .code-block-container',
    );

    expect(lightRule).toContain('--code-token-keyword-foreground');
    expect(lightRule).toContain('#af00db'); // light theme fallback for keyword
    expect(lightRule).toContain('#a31515'); // light theme fallback for string
    expect(hcRule).toContain('--code-token-comment-foreground');
    expect(hcRule).toContain('#7ca668'); // high-contrast brighter comment color
    expect(hcRule).toContain('--code-token-operator-foreground');
    expect(hcRule).toContain('#ffffff'); // high-contrast white operator color
  });

  it('regression: highlights plain JS/TS identifiers like client and body as variables', () => {
    const code = 'const client = getOpencodeClient();';
    const { container } = render(<CodeBlock code={code} lang="typescript" />);

    const variableToken = container.querySelector('.token.variable');
    expect(variableToken).toBeInTheDocument();
    expect(variableToken?.textContent).toBe('client');
  });
});
