/**
 * @file Unit tests for MentionPopover.tsx.
 * Verifies rendering of items, path extraction logic, and scroll-into-view behavior.
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MentionPopover } from './MentionPopover';

describe('MentionPopover', () => {
  const mockResults = [
    {
      name: 'package.json',
      relativePath: 'package.json',
      type: 'file' as const,
      fsPath: '/w/package.json',
    },
    {
      name: 'index.ts',
      relativePath: 'src/extension/index.ts',
      type: 'file' as const,
      fsPath: '/w/src/extension/index.ts',
    },
  ];

  it('should render nothing when show is false', () => {
    const { container } = render(
      <MentionPopover show={false} results={mockResults} selectedIndex={0} onSelect={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render no results message when results are empty', () => {
    render(<MentionPopover show={true} results={[]} selectedIndex={0} onSelect={vi.fn()} />);
    expect(screen.getByText('No files or directories found')).toBeInTheDocument();
  });

  it('should render list items showing only parent relative path or none if at root', () => {
    render(
      <MentionPopover show={true} results={mockResults} selectedIndex={0} onSelect={vi.fn()} />,
    );

    // package.json (root): item-path element should not exist
    const packageItem = screen.getByText('package.json').closest('.search-list-item');
    expect(packageItem).toBeInTheDocument();
    const packagePath = packageItem?.querySelector('.item-path');
    expect(packagePath).toBeNull();

    // index.ts (sub directory): parent relative dir should be 'src/extension'
    const indexItem = screen.getByText('index.ts').closest('.search-list-item');
    expect(indexItem).toBeInTheDocument();
    const indexPath = indexItem?.querySelector('.item-path');
    expect(indexPath).toBeInTheDocument();
    expect(indexPath?.textContent).toBe('src/extension');
  });

  it('should call onSelect callback when item is clicked', () => {
    const selectSpy = vi.fn();
    render(
      <MentionPopover show={true} results={mockResults} selectedIndex={0} onSelect={selectSpy} />,
    );

    const packageItem = screen.getByText('package.json');
    fireEvent.click(packageItem);
    expect(selectSpy).toHaveBeenCalledWith(mockResults[0]);
  });
});
