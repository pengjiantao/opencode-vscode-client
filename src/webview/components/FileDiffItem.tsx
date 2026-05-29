/**
 * @file Collapsible accordion item for a single file's diff in the review page.
 * Shows file header with icon, name, directory, stats, and expandable diff content.
 */

import type { SnapshotFileDiff } from '@opencode-ai/sdk/v2/client';
import { useState } from 'react';
import { useIPC } from '../hooks/useIPC';
import { getDirectory, getFileIcon, getFilename } from '../utils/file-icons';
import { Codicon } from './Codicon';
import { DiffPart } from './parts/DiffPart';

/** Props for the FileDiffItem component. */
export interface FileDiffItemProps {
  /** The diff data for this file. */
  diff: SnapshotFileDiff;
}

/**
 * Renders a single file diff as a collapsible accordion.
 * Header shows icon, filename, directory, and +/- stats.
 * Expanded state renders the unified diff via DiffPart.
 */
export function FileDiffItem({ diff }: FileDiffItemProps) {
  const [expanded, setExpanded] = useState(false);
  const { send } = useIPC(() => {});

  const filePath = diff.file ?? '(unknown)';
  const filename = getFilename(filePath);
  const directory = getDirectory(filePath);
  const icon = getFileIcon(filePath);
  const hasPatch = typeof diff.patch === 'string' && diff.patch.length > 0;

  const handleToggle = () => {
    setExpanded((prev) => !prev);
  };

  const handleFileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (diff.file) {
      send({ type: 'file:open', path: diff.file });
    }
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
        <span className="review-file-icon">
          <Codicon name={icon} />
        </span>
        <span
          className="review-file-name"
          role="button"
          tabIndex={-1}
          onClick={handleFileClick}
          data-custom-title={filePath}
        >
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
