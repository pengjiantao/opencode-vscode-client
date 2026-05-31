/**
 * @file Unit tests for the ToolPart component.
 * Verifies default collapsed/expanded behavior and lazy content mounting.
 */

import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ToolPart } from './ToolPart';

const baseState = {
  status: 'completed' as const,
  input: { filePath: 'test.ts', content: 'const x = 1;' },
  output: 'done',
  title: 'Edit file test.ts',
  time: { start: 1000, end: 2000 },
  metadata: {
    diff: `--- a/test.ts\n+++ b/test.ts\n@@ -1 +1 @@\n-const x = 0;\n+const x = 1;`,
  },
};

describe('ToolPart', () => {
  describe('default collapsed state', () => {
    it('file edit tool defaults to expanded', () => {
      const { container } = render(<ToolPart tool="edit" state={baseState} />);
      expect(container.querySelector('.expanded')).toBeInTheDocument();
      expect(container.querySelector('.collapsed')).not.toBeInTheDocument();
    });

    it('write_to_file tool defaults to expanded', () => {
      const { container } = render(<ToolPart tool="write_to_file" state={baseState} />);
      expect(container.querySelector('.expanded')).toBeInTheDocument();
    });

    it('write tool defaults to expanded', () => {
      const { container } = render(<ToolPart tool="write" state={baseState} />);
      expect(container.querySelector('.expanded')).toBeInTheDocument();
    });

    it('apply_patch tool defaults to expanded', () => {
      const { container } = render(<ToolPart tool="apply_patch" state={baseState} />);
      expect(container.querySelector('.expanded')).toBeInTheDocument();
    });

    it('bash tool defaults to expanded', () => {
      const bashState = {
        ...baseState,
        input: { command: 'echo hello' },
        metadata: undefined,
      };
      const { container } = render(<ToolPart tool="bash" state={bashState} />);
      expect(container.querySelector('.expanded')).toBeInTheDocument();
      expect(container.querySelector('.collapsed')).not.toBeInTheDocument();
    });

    it('question tool defaults to expanded', () => {
      const questionState = {
        ...baseState,
        input: { questions: [{ question: 'Pick one' }] },
        metadata: undefined,
      };
      const { container } = render(<ToolPart tool="question" state={questionState} />);
      expect(container.querySelector('.expanded')).toBeInTheDocument();
    });

    it('non-specialized tool defaults to collapsed', () => {
      const grepState = {
        ...baseState,
        input: { query: 'test' },
        metadata: undefined,
      };
      const { container } = render(<ToolPart tool="grep_search" state={grepState} />);
      expect(container.querySelector('.collapsed')).toBeInTheDocument();
      expect(container.querySelector('.expanded')).not.toBeInTheDocument();
    });
  });

  describe('lazy content mounting', () => {
    it('does not mount content when initially collapsed (non-specialized tool)', () => {
      const grepState = {
        ...baseState,
        input: { query: 'test' },
        metadata: undefined,
      };
      const { container } = render(<ToolPart tool="grep_search" state={grepState} />);
      // Content should not be in the DOM at all (no collapsible-wrapper)
      expect(container.querySelector('.collapsible-wrapper')).not.toBeInTheDocument();
    });

    it('mounts content on first expand click for collapsed tool', () => {
      const grepState = {
        ...baseState,
        input: { query: 'test' },
        metadata: undefined,
      };
      const { container } = render(<ToolPart tool="grep_search" state={grepState} />);
      // Click the header to expand
      const header = container.querySelector('.tool-header')!;
      fireEvent.click(header);

      // Now the content should be mounted
      expect(container.querySelector('.collapsible-wrapper')).toBeInTheDocument();
      expect(container.querySelector('.expanded')).toBeInTheDocument();
    });

    it('keeps content mounted after collapsing', () => {
      const grepState = {
        ...baseState,
        input: { query: 'test' },
        metadata: undefined,
      };
      const { container } = render(<ToolPart tool="grep_search" state={grepState} />);
      const header = container.querySelector('.tool-header')!;

      // Expand
      fireEvent.click(header);
      expect(container.querySelector('.collapsible-wrapper')).toBeInTheDocument();

      // Collapse
      fireEvent.click(header);
      // Content should still be mounted (just hidden via CSS)
      expect(container.querySelector('.collapsible-wrapper')).toBeInTheDocument();
      expect(container.querySelector('.collapsed')).toBeInTheDocument();
    });

    it('mounts content immediately for default-expanded tools', () => {
      const bashState = {
        ...baseState,
        input: { command: 'echo hello' },
        metadata: undefined,
      };
      const { container } = render(<ToolPart tool="bash" state={bashState} />);
      // Content should be mounted from the start
      expect(container.querySelector('.collapsible-wrapper')).toBeInTheDocument();
    });

    it('mounts content immediately for edit tool (default expanded)', () => {
      const { container } = render(<ToolPart tool="edit" state={baseState} />);
      // Content should be mounted from the start for edit tools
      expect(container.querySelector('.collapsible-wrapper')).toBeInTheDocument();
      expect(container.querySelector('.diff-part-container')).toBeInTheDocument();
    });
  });
});
