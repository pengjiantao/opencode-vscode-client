/**
 * @file Unit tests for the Chip component.
 * Verifies correct rendering of icon and label for files, images, and text snippets,
 * and covers click-to-open and dismiss actions.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Chip } from './Chip';

vi.mock('../store/sessionStore', () => ({
  useSessionStore: vi.fn(<T,>(selector: (state: Record<string, unknown>) => T): T => {
    const state = {
      fileInfos: {
        '/test/file.txt': {
          exists: true,
          size: 1024,
          content: 'Hello File Content',
          isWorkspace: true,
        },
      },
    };
    return selector(state);
  }),
}));

function mountChipStyles(): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = readFileSync(resolve(process.cwd(), 'src/webview/styles/chip.css'), 'utf8');
  document.head.appendChild(style);
  return style;
}

describe('Chip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a file chip with details and workspace clickability', () => {
    render(<Chip type="file" filename="file.txt" path="/test/file.txt" isWorkspace={true} />);

    const label = screen.getByText('file.txt');
    expect(label).toBeInTheDocument();

    const container = screen.getByRole('button');
    expect(container).toHaveClass('clickable');

    fireEvent.click(container);
    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'file:open',
      path: '/test/file.txt',
    });
  });

  it('renders an image chip with custom labels', () => {
    render(<Chip type="image" filename="Pasted Image" dataUrl="data:image/png;base64,..." />);

    expect(screen.getByText('Pasted Image')).toBeInTheDocument();
  });

  it('renders a text chip with line counts', () => {
    render(<Chip type="text" filename="Text" text="line1\nline2\nline3" linesCount={3} />);

    expect(screen.getByText('Pasted 3 Lines')).toBeInTheDocument();
  });

  it('renders a code-selection chip and triggers open with lines range', () => {
    render(
      <Chip
        type="code-selection"
        filename="index.ts"
        path="/test/index.ts"
        startLine={10}
        endLine={25}
      />,
    );

    const label = screen.getByText('index.ts [10-25]');
    expect(label).toBeInTheDocument();

    const container = screen.getByRole('button');
    expect(container).toHaveClass('clickable');

    fireEvent.click(container);
    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'file:open',
      path: '/test/index.ts',
      startLine: 10,
      endLine: 25,
    });
  });

  it('renders a terminal chip and is not clickable', () => {
    render(<Chip type="terminal" linesCount={5} text="output" />);

    expect(screen.getByText('terminal[5 lines]')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('regression: aligns chip icon, label, and adjacent text in inline flows', () => {
    const style = mountChipStyles();
    const { container } = render(
      <p>
        <Chip type="code-selection" filename="PromptInput.tsx" startLine={15} endLine={16} />
        <span>Cannot find module or type declarations</span>
      </p>,
    );

    const chip = container.querySelector<HTMLElement>('.opencode-chip');
    const icon = container.querySelector<HTMLElement>('.chip-icon');
    const label = container.querySelector<HTMLElement>('.chip-label');

    if (!chip || !icon || !label) {
      throw new Error('Expected chip, icon, and label elements to render.');
    }

    expect(window.getComputedStyle(chip).display).toBe('inline-flex');
    expect(window.getComputedStyle(chip).alignItems).toBe('center');
    expect(window.getComputedStyle(chip).verticalAlign).toBe('middle');
    expect(window.getComputedStyle(icon).display).toBe('inline-flex');
    expect(window.getComputedStyle(icon).alignItems).toBe('center');
    expect(window.getComputedStyle(label).display).toBe('inline-flex');
    expect(window.getComputedStyle(label).alignItems).toBe('center');

    style.remove();
  });
});
