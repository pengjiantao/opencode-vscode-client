/**
 * @file Unit tests for the DiffPart component.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DiffPart } from './DiffPart';

describe('DiffPart', () => {
  it('renders a simple unified diff with headers and content rows', () => {
    const diff = `
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
 const x = 10;
-const y = 20;
+const y = 30;
`;

    const { container } = render(<DiffPart diff={diff.trim()} filePath="file.ts" />);

    // Verify filePath header is rendered
    expect(screen.getByText('file.ts')).toBeInTheDocument();

    // Verify hunk header is rendered
    expect(screen.getByText('@@ -1,3 +1,3 @@')).toBeInTheDocument();

    // Verify line numbers and signs
    expect(screen.getAllByText('1')).toHaveLength(2);
    expect(screen.getByText('const x = 10;')).toBeInTheDocument();
    expect(screen.getByText('const y = 20;')).toBeInTheDocument();
    expect(screen.getByText('const y = 30;')).toBeInTheDocument();
    expect(container.querySelector('.diff-row-added')).toBeInTheDocument();
    expect(container.querySelector('.diff-row-removed')).toBeInTheDocument();
  });

  it('regression: interleaves hunk headers and code rows correctly in multi-hunk diffs', () => {
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

    // Get all rows in order
    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(8); // 2 headers + 3 lines from hunk1 + 3 lines from hunk2

    // Verify ordering of elements is strictly interleaved:
    // Row 0: Hunk 1 Header
    expect(rows[0].querySelector('.diff-hunk-header')?.textContent).toContain('@@ -10,1 +10,2 @@');
    // Row 1-3: Hunk 1 content lines
    expect(rows[1].className).toBe('diff-row-removed');
    expect(rows[1].textContent).toContain('old10');
    expect(rows[2].className).toBe('diff-row-added');
    expect(rows[2].textContent).toContain('new10');
    expect(rows[3].className).toBe('diff-row-added');
    expect(rows[3].textContent).toContain('extra11');

    // Row 4: Hunk 2 Header
    expect(rows[4].querySelector('.diff-hunk-header')?.textContent).toContain('@@ -20,2 +21,1 @@');
    // Row 5-7: Hunk 2 content lines
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

  it('handles clicks on headers, hunk headers, and diff lines by posting file:open IPC messages', () => {
    const diff = `
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
 const x = 10;
-const y = 20;
+const y = 30;
`;

    render(<DiffPart diff={diff.trim()} filePath="file.ts" />);

    // 1. File header click -> open file (no lines)
    vi.mocked(window.vscode.postMessage).mockClear();
    fireEvent.click(screen.getByText('file.ts'));
    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'file:open',
      path: 'file.ts',
    });

    // 2. Hunk header click -> open file at hunk new start line (1)
    vi.mocked(window.vscode.postMessage).mockClear();
    fireEvent.click(screen.getByText('@@ -1,3 +1,3 @@'));
    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'file:open',
      path: 'file.ts',
      startLine: 1,
    });

    // 3. Context line click -> open file at line 1
    vi.mocked(window.vscode.postMessage).mockClear();
    const contextRow = screen.getByText('const x = 10;').closest('tr');
    expect(contextRow).toBeInTheDocument();
    fireEvent.click(contextRow!);
    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'file:open',
      path: 'file.ts',
      startLine: 1,
    });

    // 4. Removed line click -> open file at old line 2
    vi.mocked(window.vscode.postMessage).mockClear();
    const removedRow = screen.getByText('const y = 20;').closest('tr');
    expect(removedRow).toBeInTheDocument();
    fireEvent.click(removedRow!);
    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'file:open',
      path: 'file.ts',
      startLine: 2,
    });

    // 5. Added line click -> open file and select line 2
    vi.mocked(window.vscode.postMessage).mockClear();
    const addedRow = screen.getByText('const y = 30;').closest('tr');
    expect(addedRow).toBeInTheDocument();
    fireEvent.click(addedRow!);
    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'file:open',
      path: 'file.ts',
      startLine: 2,
      endLine: 2,
    });
  });

  it('uses parsed newFile if filePath is not explicitly provided', () => {
    const diff = `
--- a/file.ts
+++ b/file.ts
@@ -1,1 +1,1 @@
 const x = 10;
`;

    render(<DiffPart diff={diff.trim()} />);

    vi.mocked(window.vscode.postMessage).mockClear();
    const contextRow = screen.getByText('const x = 10;').closest('tr');
    expect(contextRow).toBeInTheDocument();
    fireEvent.click(contextRow!);
    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'file:open',
      path: 'file.ts',
      startLine: 1,
    });
  });

  it('does not send file:open messages if path is /dev/null', () => {
    const diff = `
--- a/file.ts
+++ b/dev/null
@@ -1,1 +0,0 @@
-const x = 10;
`;

    render(<DiffPart diff={diff.trim()} />);

    // Since path is /dev/null, it is invalid for file opening, so no button role or clicks
    vi.mocked(window.vscode.postMessage).mockClear();
    const removedRow = screen.getByText('const x = 10;').closest('tr');
    expect(removedRow).toBeInTheDocument();
    expect(removedRow).not.toHaveAttribute('role', 'button');
    fireEvent.click(removedRow!);
    expect(window.vscode.postMessage).not.toHaveBeenCalled();
  });
});
