/**
 * @file Unit and regression tests for the CodeBlock component.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CodeBlock } from './CodeBlock';

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
});
