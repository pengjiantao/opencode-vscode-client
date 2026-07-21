/**
 * @file Reusable diff button component showing file change statistics.
 * Displays icon + file count + additions (green) + deletions (red).
 * Tooltip shows per-file modification details. Returns null when no diffs exist.
 */

import type { SnapshotFileDiff } from '@opencode-ai/sdk/v2/client';
import type { MouseEvent, ReactNode } from 'react';
import { useMemo } from 'react';
import { useTooltipContent } from '../utils/tooltipContentRegistry';
import { Codicon } from './Codicon';

/** Props for the DiffButton component. */
export interface DiffButtonProps {
  /** Array of file diffs to summarize. Button is hidden when empty. */
  diffs: SnapshotFileDiff[];
  /** Click handler. Receives the mouse event for coordination with parent elements. */
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  /** Optional additional CSS class names. */
  className?: string;
}

/**
 * Computes aggregate statistics from an array of file diffs.
 * @param diffs The file diff array.
 * @returns Object with fileCount, totalAdditions, totalDeletions.
 */
function computeStats(diffs: SnapshotFileDiff[]): {
  fileCount: number;
  totalAdditions: number;
  totalDeletions: number;
} {
  let totalAdditions = 0;
  let totalDeletions = 0;
  for (const d of diffs) {
    totalAdditions += d.additions;
    totalDeletions += d.deletions;
  }
  return { fileCount: diffs.length, totalAdditions, totalDeletions };
}

/**
 * Builds structured tooltip content listing per-file diff details.
 * Each row shows the file path, additions (green), and deletions (red).
 *
 * @param diffs The file diff array.
 * @returns React content for the global tooltip registry.
 */
function buildTooltipContent(diffs: SnapshotFileDiff[]): ReactNode {
  const maxRows = 30;
  return (
    <>
      <strong>Modified Files</strong>
      <table>
        <tbody>
          {diffs.slice(0, maxRows).map((diff, index) => {
            const statusIcon =
              diff.status === 'added' ? 'A' : diff.status === 'deleted' ? 'D' : 'M';
            return (
              <tr key={`${diff.file ?? 'unknown'}-${index}`}>
                <td style={{ paddingRight: '8px' }}>{statusIcon}</td>
                <td>{diff.file ?? '(unknown)'}</td>
                <td style={{ paddingLeft: '8px', textAlign: 'right' }}>
                  {diff.additions > 0 && (
                    <span style={{ color: 'var(--vscode-charts-green)' }}>+{diff.additions}</span>
                  )}{' '}
                  {diff.deletions > 0 && (
                    <span style={{ color: 'var(--vscode-charts-red)' }}>-{diff.deletions}</span>
                  )}
                </td>
              </tr>
            );
          })}
          {diffs.length > maxRows && (
            <tr>
              <td
                colSpan={3}
                style={{ color: 'var(--vscode-descriptionForeground)', paddingTop: '4px' }}
              >
                ... and {diffs.length - maxRows} more files
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}

/**
 * DiffButton displays a compact summary of file changes with a rich tooltip.
 * Renders as a standard action button with icon, file count, and +/- statistics.
 * Automatically hides when there are no diffs to display.
 */
export function DiffButton({ diffs, onClick, className = '' }: DiffButtonProps) {
  const stats = useMemo(() => computeStats(diffs), [diffs]);
  const tooltipContent = useMemo(() => buildTooltipContent(diffs), [diffs]);
  const tooltipContentId = useTooltipContent(tooltipContent);

  if (diffs.length === 0) return null;

  return (
    <button
      type="button"
      className={`action-btn diff-btn ${className}`.trim()}
      onClick={onClick}
      data-custom-title-content={tooltipContentId}
      data-testid="diff-btn"
    >
      <Codicon name="diff" />
      <span>{stats.fileCount} files</span>
      <span className="diff-added">+{stats.totalAdditions}</span>
      <span className="diff-removed">-{stats.totalDeletions}</span>
    </button>
  );
}
