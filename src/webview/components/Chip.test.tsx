/**
 * @file Unit tests for the Chip component.
 * Verifies correct rendering of icon and label for files, images, and text snippets,
 * and covers click-to-open and dismiss actions.
 */

import { fireEvent, render, screen } from '@testing-library/react';
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
});
