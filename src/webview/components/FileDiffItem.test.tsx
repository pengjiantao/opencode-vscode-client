/**
 * @file Unit tests for the FileDiffItem component.
 * Tests expand/collapse behavior, file header rendering, and diff content display.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileDiffItem } from './FileDiffItem';

describe('FileDiffItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseDiff = {
    file: 'src/utils/helper.ts',
    additions: 10,
    deletions: 3,
    status: 'modified' as const,
    patch: `--- a/src/utils/helper.ts
+++ b/src/utils/helper.ts
@@ -1,3 +1,4 @@
 import { foo } from './foo';
+import { bar } from './bar';
 export function helper() {
-  return foo();
+  return foo() + bar();
 }`,
  };

  it('renders file header with filename and directory', () => {
    render(<FileDiffItem diff={baseDiff} />);
    expect(screen.getByText('helper.ts')).toBeDefined();
    expect(screen.getByText('src/utils')).toBeDefined();
  });

  it('renders additions and deletions stats', () => {
    render(<FileDiffItem diff={baseDiff} />);
    expect(screen.getByText('+10')).toBeDefined();
    expect(screen.getByText('-3')).toBeDefined();
  });

  it('starts collapsed by default', () => {
    render(<FileDiffItem diff={baseDiff} />);
    // The diff content should not be visible initially
    expect(screen.queryByText('import { bar } from')).toBeNull();
  });

  it('expands when header is clicked', () => {
    render(<FileDiffItem diff={baseDiff} />);
    const headers = screen.getAllByRole('button', { name: /helper\.ts/ });
    fireEvent.click(headers[0]); // click the header div
    expect(screen.getByText(/import \{ bar \}/)).toBeDefined();
  });

  it('collapses when header is clicked again', () => {
    render(<FileDiffItem diff={baseDiff} />);
    const headers = screen.getAllByRole('button', { name: /helper\.ts/ });
    fireEvent.click(headers[0]); // expand
    fireEvent.click(headers[0]); // collapse
    expect(screen.queryByText('import { bar } from')).toBeNull();
  });

  it('shows patch unavailable when patch is empty', () => {
    const diffNoPatch = { ...baseDiff, patch: '' };
    render(<FileDiffItem diff={diffNoPatch} />);
    const headers = screen.getAllByRole('button', { name: /helper\.ts/ });
    fireEvent.click(headers[0]);
    expect(screen.getByText('Patch data not available for this file.')).toBeDefined();
  });

  it('handles file with no directory', () => {
    const diffRoot = { ...baseDiff, file: 'README.md' };
    render(<FileDiffItem diff={diffRoot} />);
    expect(screen.getByText('README.md')).toBeDefined();
    // No directory element should be rendered
    expect(screen.queryByText('src/utils')).toBeNull();
  });

  it('handles zero additions', () => {
    const diffDelete = { ...baseDiff, additions: 0, deletions: 5 };
    render(<FileDiffItem diff={diffDelete} />);
    expect(screen.getByText('-5')).toBeDefined();
    expect(screen.queryByText('+0')).toBeNull();
  });

  it('renders a file-type icon for the diff path', () => {
    const { container } = render(<FileDiffItem diff={baseDiff} />);
    const iconWrapper = container.querySelector('.review-file-icon');
    expect(iconWrapper).not.toBeNull();
    expect(iconWrapper?.getAttribute('aria-hidden')).toBe('true');
    // helper.ts is mapped to typescript.svg in the curated set.
    const img = iconWrapper?.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBeTruthy();
  });

  it('keeps the header role=button query matching the filename only', () => {
    // Regression: codicon/icon spans must be aria-hidden so the
    // name regex match is not contaminated.
    render(<FileDiffItem diff={baseDiff} />);
    expect(screen.getAllByRole('button', { name: /helper\.ts/ }).length).toBe(1);
  });
});
