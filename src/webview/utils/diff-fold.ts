/**
 * @file Computes foldable segments for a parsed diff.
 * Folds large blocks of unchanged context lines within and between hunks,
 * keeping a configurable number of context lines visible around each change.
 */

import type { DiffHunk, DiffLine } from './diff-parser';

/** Default number of context lines to keep visible around each change. */
const DEFAULT_CONTEXT_LINES = 3;

/**
 * A visible segment of diff lines (changes + surrounding context).
 */
export interface VisibleSegment {
  type: 'visible';
  lines: DiffLine[];
}

/**
 * A collapsed segment representing hidden context lines.
 * Stores the actual hidden lines so they can be partially expanded.
 */
export interface CollapsedSegment {
  type: 'collapsed';
  /** Number of hidden context lines. */
  count: number;
  /** The actual hidden lines, for partial expansion. */
  lines: DiffLine[];
}

/** Discriminated union of diff display segments. */
export type DiffSegment = VisibleSegment | CollapsedSegment;

/**
 * Builds display segments from parsed diff hunks.
 *
 * For each hunk, context lines that are far from any added/removed line
 * are collapsed. Only `contextLines` lines of context are kept visible
 * before and after each change group.
 *
 * @param hunks The parsed diff hunks.
 * @param contextLines Number of context lines to show around each change (default 3).
 * @returns An ordered array of display segments.
 */
export function buildSegments(
  hunks: DiffHunk[],
  contextLines: number = DEFAULT_CONTEXT_LINES,
): DiffSegment[] {
  if (hunks.length === 0) {
    return [];
  }

  const segments: DiffSegment[] = [];

  for (let hunkIdx = 0; hunkIdx < hunks.length; hunkIdx++) {
    const hunk = hunks[hunkIdx];

    // Add hunk header as a visible line
    const headerLine: DiffLine = {
      type: 'context',
      content: hunk.header,
      oldLineNumber: null,
      newLineNumber: null,
    };

    // Find indices of lines that must be visible (added, removed, or within contextLines of a change)
    const visibleIndices = computeVisibleIndices(hunk.lines, contextLines);

    // Build segments from the visibility map
    const hunkSegments = segmentsFromVisibility(hunk.lines, visibleIndices, headerLine);
    segments.push(...hunkSegments);
  }

  return segments;
}

/**
 * Computes which line indices should be visible.
 * A line is visible if it is added/removed, or within `contextLines`
 * of an added/removed line.
 */
function computeVisibleIndices(lines: DiffLine[], contextLines: number): Set<number> {
  const visible = new Set<number>();

  // If no changes exist in this hunk, keep all lines visible
  const hasChanges = lines.some((l) => l.type === 'added' || l.type === 'removed');
  if (!hasChanges) {
    for (let i = 0; i < lines.length; i++) {
      visible.add(i);
    }
    return visible;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.type === 'added' || line.type === 'removed') {
      // Mark this line and surrounding context as visible
      const start = Math.max(0, i - contextLines);
      const end = Math.min(lines.length - 1, i + contextLines);
      for (let j = start; j <= end; j++) {
        visible.add(j);
      }
    }
  }

  return visible;
}

/**
 * Converts a visibility map into visible/collapsed segments.
 * Also inserts the hunk header line at the start.
 */
function segmentsFromVisibility(
  lines: DiffLine[],
  visibleIndices: Set<number>,
  headerLine: DiffLine,
): DiffSegment[] {
  const segments: DiffSegment[] = [];

  // Start with the hunk header
  let currentVisible: DiffLine[] = [headerLine];
  let collapsedLines: DiffLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (visibleIndices.has(i)) {
      // This line is visible
      if (collapsedLines.length > 0) {
        // Flush any pending collapsed block
        segments.push({ type: 'collapsed', count: collapsedLines.length, lines: collapsedLines });
        collapsedLines = [];
      }
      currentVisible.push(lines[i]);
    } else {
      // This line is hidden
      if (currentVisible.length > 0) {
        // Flush visible block
        segments.push({ type: 'visible', lines: currentVisible });
        currentVisible = [];
      }
      collapsedLines.push(lines[i]);
    }
  }

  // Flush remaining
  if (currentVisible.length > 0) {
    segments.push({ type: 'visible', lines: currentVisible });
  }
  if (collapsedLines.length > 0) {
    segments.push({ type: 'collapsed', count: collapsedLines.length, lines: collapsedLines });
  }

  return segments;
}
