/**
 * @file Unit tests for the DiffPart component.
 */

import { render, screen } from '@testing-library/react';
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
});
