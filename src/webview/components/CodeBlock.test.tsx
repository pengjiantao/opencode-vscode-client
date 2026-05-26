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

    // Check language label is rendered uppercase
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
});
