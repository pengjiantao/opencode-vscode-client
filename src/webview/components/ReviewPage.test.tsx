/**
 * @file Unit tests for the ReviewPage component.
 * Tests IPC message handling, loading/empty/error states, and file list rendering.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtToWebview } from '../../shared/types';
import { ReviewPage } from './ReviewPage';

const mockPostMessage = vi.fn();
Object.defineProperty(window, 'vscode', {
  value: { postMessage: mockPostMessage },
  writable: true,
});

describe('ReviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function sendToReview(reviewID: string, message: ExtToWebview) {
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: message }));
    });
  }

  it('shows loading state initially', () => {
    render(<ReviewPage reviewID="test-review-1" />);
    expect(screen.getByText('Loading review data...')).toBeDefined();
  });

  it('renders file list when review:data is received', () => {
    render(<ReviewPage reviewID="test-review-1" />);
    sendToReview('test-review-1', {
      type: 'review:data',
      reviewID: 'test-review-1',
      title: 'Review Changes',
      diffs: [
        {
          file: 'src/foo.ts',
          additions: 5,
          deletions: 2,
          status: 'modified',
          patch: '--- a\n+++ b\n@@ -1 +1 @@\n-old\n+new',
        },
        {
          file: 'src/bar.tsx',
          additions: 10,
          deletions: 0,
          status: 'added',
          patch: '--- /dev/null\n+++ b\n@@ +1 @@\n+content',
        },
      ],
    });
    expect(screen.getByText('2 files changed')).toBeDefined();
    expect(screen.getByText('foo.ts')).toBeDefined();
    expect(screen.getByText('bar.tsx')).toBeDefined();
    expect(screen.getByText('+5')).toBeDefined();
    // -2 appears in both summary stats and file item stats
    expect(screen.getAllByText('-2').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('+10')).toBeDefined();
  });

  it('renders empty state when diffs array is empty', () => {
    render(<ReviewPage reviewID="test-review-2" />);
    sendToReview('test-review-2', {
      type: 'review:data',
      reviewID: 'test-review-2',
      title: 'Review Changes',
      diffs: [],
    });
    expect(screen.getByText('No file changes to review.')).toBeDefined();
  });

  it('renders error state when review:error is received', () => {
    render(<ReviewPage reviewID="test-review-3" />);
    sendToReview('test-review-3', {
      type: 'review:error',
      reviewID: 'test-review-3',
      message: 'Failed to fetch diffs',
    });
    expect(screen.getByText('Failed to fetch diffs')).toBeDefined();
  });

  it('ignores messages for different reviewIDs', () => {
    render(<ReviewPage reviewID="test-review-4" />);
    sendToReview('wrong-review', {
      type: 'review:data',
      reviewID: 'wrong-review',
      title: 'Wrong Review',
      diffs: [{ file: 'wrong.ts', additions: 1, deletions: 0, status: 'modified', patch: '' }],
    });
    // Should still be loading since the message was for a different reviewID
    expect(screen.getByText('Loading review data...')).toBeDefined();
  });

  it('sends review:close when close button is clicked', () => {
    render(<ReviewPage reviewID="test-review-5" />);
    const closeBtn = screen.getByLabelText('Close review');
    fireEvent.click(closeBtn);
    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'review:close',
      reviewID: 'test-review-5',
    });
  });

  it('displays correct summary stats', () => {
    render(<ReviewPage reviewID="test-review-6" />);
    sendToReview('test-review-6', {
      type: 'review:data',
      reviewID: 'test-review-6',
      title: 'Review Changes',
      diffs: [
        { file: 'a.ts', additions: 5, deletions: 3, status: 'modified', patch: '' },
        { file: 'b.ts', additions: 10, deletions: 7, status: 'modified', patch: '' },
      ],
    });
    expect(screen.getByText('2 files changed')).toBeDefined();
    expect(screen.getByText('+15')).toBeDefined();
    expect(screen.getByText('-10')).toBeDefined();
  });
});
