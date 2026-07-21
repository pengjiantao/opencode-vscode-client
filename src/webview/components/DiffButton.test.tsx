/**
 * @file Regression tests for the diff summary button and its React tooltip content.
 */

import type { SnapshotFileDiff } from '@opencode-ai/sdk/v2/client';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getRegisteredTooltipContent } from '../utils/tooltipContentRegistry';
import { DiffButton } from './DiffButton';

describe('DiffButton', () => {
  it('renders file details as structured React tooltip content', () => {
    const diffs: SnapshotFileDiff[] = [
      {
        file: '<unsafe>.ts',
        additions: 3,
        deletions: 2,
        status: 'modified',
        patch: '',
      },
      {
        file: 'src/added.ts',
        additions: 5,
        deletions: 0,
        status: 'added',
        patch: '',
      },
    ];

    render(<DiffButton diffs={diffs} />);
    const button = screen.getByTestId('diff-btn');
    const tooltipContent = getRegisteredTooltipContent(
      button.getAttribute('data-custom-title-content'),
    );

    expect(tooltipContent).toBeDefined();
    const { container } = render(<>{tooltipContent}</>);
    expect(screen.getByText('Modified Files')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('<unsafe>.ts')).toBeInTheDocument();
    expect(container.querySelector('unsafe')).toBeNull();
    expect(within(container).getByText('+3')).toHaveStyle({
      color: 'var(--vscode-charts-green)',
    });
    expect(within(container).getByText('-2')).toHaveStyle({ color: 'var(--vscode-charts-red)' });
  });
});
