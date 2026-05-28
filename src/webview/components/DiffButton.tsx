/**
 * @file Reusable diff button component showing file change statistics.
 * Displays icon + file count + additions (green) + deletions (red).
 * Tooltip shows per-file modification details. Returns null when no diffs exist.
 */

import type { SnapshotFileDiff } from '@opencode-ai/sdk/v2/client';
import type { MouseEvent } from 'react';
import { useMemo } from 'react';
import { escapeHtml } from '../utils/chipUtils';
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
 * Builds an HTML tooltip string listing per-file diff details.
 * Each row shows the file path, additions (green), and deletions (red).
 *
 * @param diffs The file diff array.
 * @returns HTML string for use with data-custom-title.
 */
function buildTooltipHtml(diffs: SnapshotFileDiff[]): string {
  if (diffs.length === 0) return '';

  const header = '<strong>Modified Files</strong>';
  const maxRows = 30;
  const rows = diffs.slice(0, maxRows).map((d) => {
    const file = escapeHtml(d.file ?? '(unknown)');
    const statusIcon = d.status === 'added' ? 'A' : d.status === 'deleted' ? 'D' : 'M';
    const additionsHtml = d.additions
      ? `<span style="color:var(--vscode-charts-green)">+${d.additions}</span>`
      : '';
    const deletionsHtml = d.deletions
      ? `<span style="color:var(--vscode-charts-red)">-${d.deletions}</span>`
      : '';
    const stats = [additionsHtml, deletionsHtml].filter(Boolean).join(' ');
    return `<tr><td style="padding-right:8px">${statusIcon}</td><td>${file}</td><td style="padding-left:8px;text-align:right">${stats}</td></tr>`;
  });

  const truncationNote =
    diffs.length > maxRows
      ? `<tr><td colspan="3" style="color:var(--vscode-descriptionForeground);padding-top:4px">... and ${diffs.length - maxRows} more files</td></tr>`
      : '';

  return `${header}<br/><table>${rows.join('')}${truncationNote}</table>`;
}

/**
 * DiffButton displays a compact summary of file changes with a rich tooltip.
 * Renders as a standard action button with icon, file count, and +/- statistics.
 * Automatically hides when there are no diffs to display.
 */
export function DiffButton({ diffs, onClick, className = '' }: DiffButtonProps) {
  const stats = useMemo(() => computeStats(diffs), [diffs]);
  const tooltipHtml = useMemo(() => buildTooltipHtml(diffs), [diffs]);

  if (diffs.length === 0) return null;

  return (
    <button
      type="button"
      className={`action-btn diff-btn ${className}`.trim()}
      onClick={onClick}
      data-custom-title={tooltipHtml}
      data-testid="diff-btn"
    >
      <Codicon name="diff" />
      <span>{stats.fileCount} files</span>
      <span className="diff-added">+{stats.totalAdditions}</span>
      <span className="diff-removed">-{stats.totalDeletions}</span>
    </button>
  );
}
