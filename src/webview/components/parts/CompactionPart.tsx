/**
 * @file Renders a compaction part as a visual divider with a descriptive label.
 * Displays a horizontal-line-label-line pattern indicating the session was compacted,
 * with context-aware text based on whether compaction was automatic or manual.
 */

import type { Part } from '@opencode-ai/sdk/v2/client';
import React from 'react';
import { Codicon } from '../Codicon';

interface CompactionPartProps {
  /** The compaction part containing trigger metadata. */
  part: Extract<Part, { type: 'compaction' }>;
}

/**
 * Builds a human-readable label from the compaction part's metadata.
 * Describes whether compaction was automatic (and why) or manual.
 */
function getCompactionLabel(part: Extract<Part, { type: 'compaction' }>): string {
  const auto = part.auto;
  const overflow = part.overflow;

  if (auto && overflow) return 'Context overflow — auto-compacted';
  if (auto) return 'Auto-compacted';
  return 'Session compacted';
}

/** Renders a divider-style compaction indicator with a descriptive label. */
export const CompactionPart = React.memo(function CompactionPart({ part }: CompactionPartProps) {
  const label = getCompactionLabel(part);

  return (
    <div className="compaction-part">
      <div className="compaction-part-divider">
        <span className="compaction-part-line" />
        <span className="compaction-part-label">
          <Codicon name="history" />
          <span>{label}</span>
        </span>
        <span className="compaction-part-line" />
      </div>
    </div>
  );
});
