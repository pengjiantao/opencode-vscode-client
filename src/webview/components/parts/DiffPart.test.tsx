/**
 * @file Unit tests for the DiffPart component.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DiffPart } from './DiffPart';

describe('DiffPart', () => {
  it('renders a simple unified diff with content rows', () => {
    const diff = `
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
 const x = 10;
-const y = 20;
+const y = 30;
`;

    const { container } = render(<DiffPart diff={diff.trim()} filePath="file.ts" />);

    expect(screen.getByText('file.ts')).toBeInTheDocument();
    expect(screen.getByText('const x = 10;')).toBeInTheDocument();
    expect(screen.getByText('const y = 20;')).toBeInTheDocument();
    expect(screen.getByText('const y = 30;')).toBeInTheDocument();
    expect(container.querySelector('.diff-row-added')).toBeInTheDocument();
    expect(container.querySelector('.diff-row-removed')).toBeInTheDocument();
  });

  it('renders hunk header and code rows in order for multi-hunk diffs', () => {
    const diff = `
--- a/file.ts
+++ b/file.ts
@@ -10,1 +10,2 @@
-old10
+new10
+extra11
@@ -20,2 +21,1 @@
-old20
-old21
+new20
`;

    const { container } = render(<DiffPart diff={diff.trim()} />);

    const rows = container.querySelectorAll('tbody tr');
    // 2 hunk headers + 3 lines hunk1 + 3 lines hunk2 = 8 rows
    expect(rows).toHaveLength(8);

    // Verify hunk headers
    expect(rows[0].querySelector('.diff-hunk-header')?.textContent).toContain('@@ -10,1 +10,2 @@');
    expect(rows[4].querySelector('.diff-hunk-header')?.textContent).toContain('@@ -20,2 +21,1 @@');

    // Verify hunk 1 content
    expect(rows[1].className).toBe('diff-row-removed');
    expect(rows[1].textContent).toContain('old10');
    expect(rows[2].className).toBe('diff-row-added');
    expect(rows[2].textContent).toContain('new10');
    expect(rows[3].className).toBe('diff-row-added');
    expect(rows[3].textContent).toContain('extra11');

    // Verify hunk 2 content
    expect(rows[5].className).toBe('diff-row-removed');
    expect(rows[5].textContent).toContain('old20');
    expect(rows[6].className).toBe('diff-row-removed');
    expect(rows[6].textContent).toContain('old21');
    expect(rows[7].className).toBe('diff-row-added');
    expect(rows[7].textContent).toContain('new20');
  });

  it('renders fallback when no hunks are parsed', () => {
    render(<DiffPart diff="" />);
    expect(screen.getByText('No changes to display')).toBeInTheDocument();
  });

  it('handles clicks on file header and diff lines', () => {
    const diff = `
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
 const x = 10;
-const y = 20;
+const y = 30;
`;

    render(<DiffPart diff={diff.trim()} filePath="file.ts" />);

    // File header click
    vi.mocked(window.vscode.postMessage).mockClear();
    fireEvent.click(screen.getByText('file.ts'));
    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'file:open',
      path: 'file.ts',
    });

    // Context line click
    vi.mocked(window.vscode.postMessage).mockClear();
    const contextRow = screen.getByText('const x = 10;').closest('tr');
    fireEvent.click(contextRow!);
    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'file:open',
      path: 'file.ts',
      startLine: 1,
    });

    // Removed line click
    vi.mocked(window.vscode.postMessage).mockClear();
    const removedRow = screen.getByText('const y = 20;').closest('tr');
    fireEvent.click(removedRow!);
    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'file:open',
      path: 'file.ts',
      startLine: 2,
    });

    // Added line click
    vi.mocked(window.vscode.postMessage).mockClear();
    const addedRow = screen.getByText('const y = 30;').closest('tr');
    fireEvent.click(addedRow!);
    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'file:open',
      path: 'file.ts',
      startLine: 2,
      endLine: 2,
    });
  });

  it('uses parsed newFile if filePath is not provided', () => {
    const diff = `
--- a/file.ts
+++ b/file.ts
@@ -1,1 +1,1 @@
 const x = 10;
`;

    render(<DiffPart diff={diff.trim()} />);

    vi.mocked(window.vscode.postMessage).mockClear();
    const contextRow = screen.getByText('const x = 10;').closest('tr');
    fireEvent.click(contextRow!);
    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'file:open',
      path: 'file.ts',
      startLine: 1,
    });
  });

  it('does not send file:open if path is /dev/null', () => {
    const diff = `
--- a/file.ts
+++ b/dev/null
@@ -1,1 +0,0 @@
-const x = 10;
`;

    render(<DiffPart diff={diff.trim()} />);

    vi.mocked(window.vscode.postMessage).mockClear();
    const removedRow = screen.getByText('const x = 10;').closest('tr');
    expect(removedRow).not.toHaveAttribute('role', 'button');
    fireEvent.click(removedRow!);
    expect(window.vscode.postMessage).not.toHaveBeenCalled();
  });

  it('folds long context blocks within a hunk', () => {
    // Build a diff with 15 leading context lines before a change
    const contextLines = Array.from({ length: 15 }, (_, i) => ` line${i + 1};`).join('\n');
    const diff = `
--- a/file.ts
+++ b/file.ts
@@ -1,18 +1,18 @@
${contextLines}
-oldLine
+newLine
 line16;
 line17;
 line18;
`;

    const { container } = render(<DiffPart diff={diff.trim()} filePath="file.ts" />);

    // Should have collapsed blocks
    const collapsedRows = container.querySelectorAll('.diff-collapsed-row');
    expect(collapsedRows.length).toBeGreaterThan(0);

    // Should show two +10 expand buttons
    const expandBtns = screen.getAllByText('+10');
    expect(expandBtns.length).toBe(2);
  });

  it('expand all reveals all hidden context', () => {
    const contextLines = Array.from({ length: 15 }, (_, i) => ` line${i + 1};`).join('\n');
    const diff = `
--- a/file.ts
+++ b/file.ts
@@ -1,18 +1,18 @@
${contextLines}
-oldLine
+newLine
 line16;
 line17;
 line18;
`;

    const { container } = render(<DiffPart diff={diff.trim()} filePath="file.ts" />);

    // Initially collapsed
    expect(container.querySelector('.diff-collapsed-row')).toBeInTheDocument();

    // Click the count button to expand all
    const countBtn = container.querySelector('.diff-collapsed-count-btn');
    expect(countBtn).toBeInTheDocument();
    fireEvent.click(countBtn!);

    // Collapsed block should be gone
    expect(container.querySelector('.diff-collapsed-row')).not.toBeInTheDocument();
  });

  it('expand 10 increases visible context', () => {
    const contextLines = Array.from({ length: 30 }, (_, i) => ` line${i + 1};`).join('\n');
    const diff = `
--- a/file.ts
+++ b/file.ts
@@ -1,33 +1,33 @@
${contextLines}
-oldLine
+newLine
`;

    const { container } = render(<DiffPart diff={diff.trim()} filePath="file.ts" />);

    // Initially collapsed
    expect(container.querySelector('.diff-collapsed-row')).toBeInTheDocument();

    // Click first +10 button
    const expandBtns = screen.getAllByText('+10');
    fireEvent.click(expandBtns[0]);

    // Should still be collapsed (gap is large enough)
    expect(container.querySelector('.diff-collapsed-row')).toBeInTheDocument();
  });

  it('updates rendered content when diff prop changes', () => {
    const diff1 = `--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+new`;
    const diff2 = `--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-previous\n-updated`;

    const { rerender } = render(<DiffPart diff={diff1} filePath="file.ts" />);
    expect(screen.getByText('old')).toBeInTheDocument();
    expect(screen.getByText('new')).toBeInTheDocument();

    rerender(<DiffPart diff={diff2} filePath="file.ts" />);
    expect(screen.queryByText('old')).not.toBeInTheDocument();
    expect(screen.getByText('previous')).toBeInTheDocument();
    expect(screen.getByText('updated')).toBeInTheDocument();
  });
});
