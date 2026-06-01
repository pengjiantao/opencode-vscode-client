/**
 * @file Collapsible accordion item for a single file's diff in the review page.
 * Shows file header with icon, name, directory, stats, and expandable diff content.
 */

import type { SnapshotFileDiff } from '@opencode-ai/sdk/v2/client';
import { useState } from 'react';
import { getDirectory, getFilename } from '../utils/file-icons';
import { Codicon } from './Codicon';
import { DiffPart } from './parts/DiffPart';

/** Props for the FileDiffItem component. */
export interface FileDiffItemProps {
  /** The diff data for this file. */
  diff: SnapshotFileDiff;
  /** Whether the item starts expanded. Defaults to false. */
  defaultExpanded?: boolean;
}

/**
 * Renders a single file diff as a collapsible accordion.
 * Header shows icon, filename, directory, and +/- stats.
 * Expanded state renders the unified diff via DiffPart.
 */
export function FileDiffItem({ diff, defaultExpanded = false }: FileDiffItemProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const filePath = diff.file ?? '(unknown)';
  const filename = getFilename(filePath);
  const directory = getDirectory(filePath);
  const hasPatch = typeof diff.patch === 'string' && diff.patch.length > 0;

  const handleToggle = () => {
    setExpanded((prev) => !prev);
  };

  return (
    <div className="review-file-item">
      <div
        className="review-file-header"
        role="button"
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        }}
      >
        <span className={`review-file-chevron ${expanded ? 'expanded' : ''}`}>
          <Codicon name="chevron-right" />
        </span>
        <span className="review-file-name" data-custom-title={filePath}>
          {filename}
        </span>
        {directory && (
          <span className="review-file-dir" data-custom-title={directory}>
            {directory}
          </span>
        )}
        <span className="review-file-stats">
          {diff.additions > 0 && <span className="review-stat-added">+{diff.additions}</span>}
          {diff.deletions > 0 && <span className="review-stat-removed">-{diff.deletions}</span>}
        </span>
      </div>
      {expanded && (
        <div className="review-file-diff">
          {hasPatch ? (
            <DiffPart diff={diff.patch!} filePath={diff.file} />
          ) : (
            <div className="review-patch-unavailable">Patch data not available for this file.</div>
          )}
        </div>
      )}
    </div>
  );
}
