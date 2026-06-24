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

  it('renders file type icon in header when filePath is provided', () => {
    const diff = `
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
 const x = 10;
-const y = 20;
+const y = 30;
`;

    const { container } = render(<DiffPart diff={diff.trim()} filePath="file.ts" />);

    const header = container.querySelector('.diff-file-header');
    expect(header).not.toBeNull();

    const icon = header!.querySelector('img');
    expect(icon).not.toBeNull();
    expect(icon!.getAttribute('src')).toBeTruthy();
    expect(icon!.getAttribute('width')).toBe('14');
  });

  it('fallback when no hunks are parsed', () => {
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

    // Context line click should not trigger file:open (non-interactive)
    vi.mocked(window.vscode.postMessage).mockClear();
    const contextRow = screen.getByText('const x = 10;').closest('tr');
    expect(contextRow).not.toHaveAttribute('role', 'button');
    fireEvent.click(contextRow!);
    expect(window.vscode.postMessage).not.toHaveBeenCalled();

    // Removed line click (part of change block, triggers on parent tbody)
    vi.mocked(window.vscode.postMessage).mockClear();
    const removedRow = screen.getByText('const y = 20;').closest('tr');
    fireEvent.click(removedRow!);
    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'file:open',
      path: 'file.ts',
      startLine: 2,
      endLine: 2,
    });

    // Added line click (part of change block, triggers on parent tbody)
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
-old_x
+new_x
`;

    render(<DiffPart diff={diff.trim()} />);

    vi.mocked(window.vscode.postMessage).mockClear();
    const addedRow = screen.getByText('new_x').closest('tr');
    fireEvent.click(addedRow!);
    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'file:open',
      path: 'file.ts',
      startLine: 1,
      endLine: 1,
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
    const tbody = removedRow?.closest('tbody');
    expect(tbody).not.toHaveAttribute('role', 'button');
    fireEvent.click(removedRow!);
    expect(window.vscode.postMessage).not.toHaveBeenCalled();
  });

  it('regression: clicks on contiguous replacement block selects range', () => {
    const diff = `
--- a/file.ts
+++ b/file.ts
@@ -3,3 +3,3 @@
-old3
-old4
-old5
+new3
+new4
+new5
`;

    render(<DiffPart diff={diff.trim()} filePath="file.ts" />);

    vi.mocked(window.vscode.postMessage).mockClear();
    const addedRow = screen.getByText('new4').closest('tr');
    fireEvent.click(addedRow!);
    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'file:open',
      path: 'file.ts',
      startLine: 3,
      endLine: 5,
    });
  });

  it('regression: clicks on pure additions block selects range', () => {
    const diff = `
--- a/file.ts
+++ b/file.ts
@@ -3,0 +3,3 @@
+new3
+new4
+new5
`;

    render(<DiffPart diff={diff.trim()} filePath="file.ts" />);

    vi.mocked(window.vscode.postMessage).mockClear();
    const addedRow = screen.getByText('new4').closest('tr');
    fireEvent.click(addedRow!);
    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'file:open',
      path: 'file.ts',
      startLine: 3,
      endLine: 5,
    });
  });

  it('regression: clicks on pure deletions block jumps to the nearest line following deletions', () => {
    const diff = `
--- a/file.ts
+++ b/file.ts
@@ -3,3 +3,1 @@
-old3
-old4
-old5
  context6
`;

    render(<DiffPart diff={diff.trim()} filePath="file.ts" />);

    vi.mocked(window.vscode.postMessage).mockClear();
    const removedRow = screen.getByText('old4').closest('tr');
    fireEvent.click(removedRow!);
    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'file:open',
      path: 'file.ts',
      startLine: 3, // context6 newLineNumber is 3
    });
  });

  it('regression: clicks on pure deletions block at end of file jumps to nearest line preceding deletions', () => {
    const diff = `
--- a/file.ts
+++ b/file.ts
@@ -2,3 +2,1 @@
  context2
-old3
-old4
-old5
`;

    render(<DiffPart diff={diff.trim()} filePath="file.ts" />);

    vi.mocked(window.vscode.postMessage).mockClear();
    const removedRow = screen.getByText('old4').closest('tr');
    fireEvent.click(removedRow!);
    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'file:open',
      path: 'file.ts',
      startLine: 2, // context2 newLineNumber is 2
    });
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

  it('expandAll renders all context lines without collapsed blocks', () => {
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

    const { container } = render(<DiffPart diff={diff.trim()} filePath="file.ts" expandAll />);

    // No collapsed blocks should exist
    expect(container.querySelector('.diff-collapsed-row')).not.toBeInTheDocument();

    // All context lines should be visible
    expect(screen.getByText('line1;')).toBeInTheDocument();
    expect(screen.getByText('line10;')).toBeInTheDocument();
    expect(screen.getByText('line15;')).toBeInTheDocument();
    expect(screen.getByText('line16;')).toBeInTheDocument();
    expect(screen.getByText('line18;')).toBeInTheDocument();

    // Change lines should still be present
    expect(screen.getByText('oldLine')).toBeInTheDocument();
    expect(screen.getByText('newLine')).toBeInTheDocument();
  });

  it('expandAll=false (default) still folds context lines', () => {
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

    // Should have collapsed blocks (default behavior)
    const collapsedRows = container.querySelectorAll('.diff-collapsed-row');
    expect(collapsedRows.length).toBeGreaterThan(0);
  });

  it('regression: line number gutter is shown by default (review page)', () => {
    const diff = `
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
 const x = 10;
-const y = 20;
+const y = 30;
`;

    const { container } = render(<DiffPart diff={diff.trim()} filePath="file.ts" />);

    // Gutter cells are present.
    expect(container.querySelectorAll('.diff-line-num').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.old-num').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.new-num').length).toBeGreaterThan(0);

    // Each non-hunk line row carries all four cells (old-num, new-num,
    // sign, code).
    const codeRow = screen.getByText('const y = 30;').closest('tr');
    expect(codeRow).not.toBeNull();
    expect(codeRow!.querySelectorAll('td')).toHaveLength(4);
    expect(codeRow!.querySelector('.old-num')).not.toBeNull();
    expect(codeRow!.querySelector('.new-num')).not.toBeNull();
    expect(codeRow!.querySelector('.diff-sign')).not.toBeNull();
    expect(codeRow!.querySelector('.diff-code')).not.toBeNull();

    // The table gets the with-gutter marker so the collapsed indicator
    // can keep its original 40px left padding.
    const table = container.querySelector('.diff-table');
    expect(table).not.toBeNull();
    expect(table!.classList.contains('diff-table-with-gutter')).toBe(true);
  });

  it('regression: hunk header cell spans the full four-column table when gutter is shown', () => {
    const diff = `
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
-const y = 20;
+const y = 30;
`;

    const { container } = render(<DiffPart diff={diff.trim()} filePath="file.ts" />);

    const hunkCell = container.querySelector('.diff-hunk-header');
    expect(hunkCell).not.toBeNull();
    expect(hunkCell!.getAttribute('colspan')).toBe('4');
  });

  it('regression: showLineNumbers={false} hides the gutter (tool rendering)', () => {
    const diff = `
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
 const x = 10;
-const y = 20;
+const y = 30;
`;

    const { container } = render(
      <DiffPart diff={diff.trim()} filePath="file.ts" showLineNumbers={false} />,
    );

    // No gutter cells of any kind.
    expect(container.querySelectorAll('.diff-line-num').length).toBe(0);
    expect(container.querySelectorAll('.old-num').length).toBe(0);
    expect(container.querySelectorAll('.new-num').length).toBe(0);

    // Each non-hunk line row only has two cells (sign + code).
    const codeRow = screen.getByText('const y = 30;').closest('tr');
    expect(codeRow).not.toBeNull();
    expect(codeRow!.querySelectorAll('td')).toHaveLength(2);
    expect(codeRow!.querySelector('.diff-sign')).not.toBeNull();
    expect(codeRow!.querySelector('.diff-code')).not.toBeNull();

    // The with-gutter marker is absent, so the collapsed indicator uses
    // the compact 8px left padding.
    const table = container.querySelector('.diff-table');
    expect(table).not.toBeNull();
    expect(table!.classList.contains('diff-table-with-gutter')).toBe(false);

    // Hunk header colspan drops to 2 to match the trimmed column count.
    const hunkCell = container.querySelector('.diff-hunk-header');
    expect(hunkCell).not.toBeNull();
    expect(hunkCell!.getAttribute('colspan')).toBe('2');
  });

  it('regression: long lines do not wrap and a horizontal-scroll wrapper is present', () => {
    const longLine = `const huge = ${"'x'".repeat(150)};`;
    const diff = `
--- a/file.ts
+++ b/file.ts
@@ -1,1 +1,1 @@
-old
+${longLine}
`;

    // This applies regardless of whether the gutter is shown.
    const { container } = render(
      <DiffPart diff={diff.trim()} filePath="file.ts" showLineNumbers={false} />,
    );

    // Horizontal-scroll wrapper must exist around the table.
    const xscroll = container.querySelector('.diff-table-xscroll');
    expect(xscroll).not.toBeNull();
    // The table should be inside the wrapper.
    expect(xscroll!.querySelector('.diff-table')).not.toBeNull();

    // The .diff-code cell must keep `white-space: pre` so the long line
    // never wraps. We assert the CSS source directly because the test
    // environment does not load parts.css (it is only imported from
    // main.tsx / ReviewPage.tsx, which tests do not import).
    const css = readDiffStyles();
    expect(extractRuleBody(css, '.diff-code')).toMatch(/white-space:\s*pre\b/);
    expect(extractRuleBody(css, '.diff-code')).not.toMatch(/word-break/);

    // The .diff-table should declare width: max-content; so long lines
    // extend the table instead of forcing a wrap, and min-width: 100% to
    // keep short diffs full-width.
    const tableRule = extractRuleBody(css, '.diff-table');
    expect(tableRule).toMatch(/width:\s*max-content/);
    expect(tableRule).toMatch(/min-width:\s*100%/);

    // The horizontal-scroll wrapper itself must declare overflow-x: auto.
    expect(extractRuleBody(css, '.diff-table-xscroll')).toMatch(/overflow-x:\s*auto/);
  });
});

/**
 * Reads the diff-related portion of parts.css. The file is large and only
 * a small section contains diff rules, but reading the whole file is cheap
 * and keeps the test resilient to line shifts.
 */
function readDiffStyles(): string {
  // The build resolves this relative to the project root in the same way
  // as the source files; vitest shares the same resolution.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs') as typeof import('fs');
  // Path is resolved relative to the test file's location, which vitest
  // runs from the project root for `*.test.tsx` files.
  const cssPath = 'src/webview/styles/parts.css';
  return fs.readFileSync(cssPath, 'utf8');
}

/**
 * Returns the body of the first CSS rule whose selector exactly matches
 * `selector`. Whitespace inside the body is preserved so the caller can
 * use regex assertions like `white-space:\s*pre\b`.
 */
function extractRuleBody(css: string, selector: string): string {
  // Escape regex metacharacters in the selector (`.` -> `\.`).
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'm');
  const match = css.match(re);
  return match ? match[1] : '';
}
