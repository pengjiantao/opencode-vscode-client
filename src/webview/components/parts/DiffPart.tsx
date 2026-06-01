/**
 * @file Renders a structured, syntax-aware or color-coded diff view for file modifications.
 * Context lines far from changes are folded, showing 3 lines of context around each change.
 * Supports per-segment directional expansion (first 10 / last 10 / all).
 */

import { memo, useCallback, useMemo, useState } from 'react';
import { useIPC } from '../../hooks/useIPC';
import { buildSegments } from '../../utils/diff-fold';
import type { DiffLine } from '../../utils/diff-parser';
import { parseDiff } from '../../utils/diff-parser';
import { Codicon } from '../Codicon';
import { CollapsedBlock } from './CollapsedBlock';

/** Default number of context lines to show around each change. */
const DEFAULT_CONTEXT_LINES = 3;

/** Per-collapsed-segment expansion state. */
interface SegmentExpansion {
  startExpanded: number;
  endExpanded: number;
}

interface DiffPartProps {
  /** The raw unified diff string to render. */
  diff: string;
  /** Optional file path to show context. */
  filePath?: string;
  /** Optional execution status to show a success/error icon in the header. */
  status?: 'pending' | 'running' | 'completed' | 'error';
}

/**
 * Checks if a line is a hunk header (has null line numbers and looks like @@ ... @@).
 */
function isHunkHeaderLine(line: {
  content: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
}): boolean {
  return (
    line.oldLineNumber === null && line.newLineNumber === null && line.content.startsWith('@@')
  );
}

/**
 * Stable per-line key, independent of whether the line is currently visible,
 * fully expanded, or partially expanded. Keeping the same key for the same
 * (segmentIdx, lineIdx) across all rendering paths prevents React from
 * unmounting and remounting DOM nodes when expansion state toggles.
 */
function lineKey(segIdx: number, lineIdx: number): string {
  return `seg-${segIdx}-line-${lineIdx}`;
}

/**
 * Represents a partitioned block of diff lines of the same structural type.
 */
interface LineBlock {
  /** The type of block: a hunk header, context lines, or change lines (additions/deletions). */
  type: 'hunk-header' | 'context' | 'change';
  /** The list of diff lines in this block. */
  lines: DiffLine[];
}

/**
 * Partitions a list of diff lines into contiguous blocks of:
 * - Hunk headers
 * - Unmodified context lines
 * - Contiguous changes (added/removed lines)
 * This allows us to group modifications into single interactive components.
 */
function partitionLines(lines: DiffLine[]): LineBlock[] {
  const blocks: LineBlock[] = [];
  let currentBlock: LineBlock | null = null;

  for (const line of lines) {
    let lineType: 'hunk-header' | 'context' | 'change';
    if (isHunkHeaderLine(line)) {
      lineType = 'hunk-header';
    } else if (line.type === 'context') {
      lineType = 'context';
    } else {
      lineType = 'change';
    }

    if (currentBlock && currentBlock.type === lineType) {
      currentBlock.lines.push(line);
    } else {
      currentBlock = {
        type: lineType,
        lines: [line],
      };
      blocks.push(currentBlock);
    }
  }

  return blocks;
}

/**
 * Searches the surrounding visible segment lines to find the nearest valid line number
 * in the modified (new) file. This is used when a pure deletion block is clicked,
 * providing a logical target line number near the deletion location in the new file.
 */
function findNearestNewLineNumber(
  segmentLines: DiffLine[],
  blockStartIdx: number,
  blockEndIdx: number,
): number {
  // Search forward in the segment lines
  for (let i = blockEndIdx + 1; i < segmentLines.length; i++) {
    if (segmentLines[i].newLineNumber !== null) {
      return segmentLines[i].newLineNumber!;
    }
  }
  // Search backward in the segment lines
  for (let i = blockStartIdx - 1; i >= 0; i--) {
    if (segmentLines[i].newLineNumber !== null) {
      return segmentLines[i].newLineNumber!;
    }
  }
  return 1;
}

/**
 * Renders a single diff line as a table row.
 *
 * Memoized: re-renders are skipped when the line reference stays the same.
 */
const DiffLineRow = memo(function DiffLineRow({ line }: { line: DiffLine }) {
  if (isHunkHeaderLine(line)) {
    return (
      <tr className="diff-hunk-header-row">
        <td colSpan={4} className="diff-hunk-header">
          {line.content}
        </td>
      </tr>
    );
  }

  const rowClass =
    line.type === 'added'
      ? 'diff-row-added'
      : line.type === 'removed'
        ? 'diff-row-removed'
        : 'diff-row-context';

  const displayOld = line.oldLineNumber !== null ? String(line.oldLineNumber) : '';
  const displayNew = line.newLineNumber !== null ? String(line.newLineNumber) : '';
  const sign = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';

  return (
    <tr className={rowClass}>
      <td className="diff-line-num old-num">{displayOld}</td>
      <td className="diff-line-num new-num">{displayNew}</td>
      <td className="diff-sign">{sign}</td>
      <td className="diff-code">{line.content}</td>
    </tr>
  );
});

/**
 * Renders a unified diff in a tabular structure with separate line numbers
 * and change symbols. Context lines far from changes are folded by default,
 * showing 3 lines of context around each change. Supports per-segment
 * directional expansion. Contiguous modifications are grouped into interactive
 * tbody blocks.
 */
export function DiffPart({ diff, filePath, status }: DiffPartProps) {
  const { send } = useIPC(() => {});
  const parsed = useMemo(() => parseDiff(diff), [diff]);

  const resolvedPath = filePath || parsed.newFile;
  const hasValidPath =
    !!resolvedPath && resolvedPath !== '/dev/null' && resolvedPath !== 'dev/null';

  const segments = useMemo(
    () => buildSegments(parsed.hunks, DEFAULT_CONTEXT_LINES),
    [parsed.hunks],
  );

  // Per-collapsed-segment expansion state: how many lines expanded from start and end
  const [expansionMap, setExpansionMap] = useState<Record<number, SegmentExpansion>>({});

  const handleExpandStart = useCallback((segIdx: number, n: number) => {
    setExpansionMap((prev) => {
      const current = prev[segIdx] ?? { startExpanded: 0, endExpanded: 0 };
      return { ...prev, [segIdx]: { ...current, startExpanded: current.startExpanded + n } };
    });
  }, []);

  const handleExpandEnd = useCallback((segIdx: number, n: number) => {
    setExpansionMap((prev) => {
      const current = prev[segIdx] ?? { startExpanded: 0, endExpanded: 0 };
      return { ...prev, [segIdx]: { ...current, endExpanded: current.endExpanded + n } };
    });
  }, []);

  const handleExpandAll = useCallback(
    (segIdx: number) => {
      setExpansionMap((prev) => {
        const seg = segments[segIdx];
        if (!seg || seg.type !== 'collapsed') return prev;
        const totalCount = seg.count;
        return { ...prev, [segIdx]: { startExpanded: totalCount, endExpanded: 0 } };
      });
    },
    [segments],
  );

  // If the diff yielded no hunks (e.g. empty or parsing failed), return a minimal fallback
  if (parsed.hunks.length === 0) {
    return (
      <div className="diff-empty-fallback">
        <span>No changes to display</span>
      </div>
    );
  }

  const statusIcon =
    status === 'completed' ? (
      <Codicon name="$(check)" className="diff-file-header-icon diff-file-header-icon-success" />
    ) : status === 'error' ? (
      <Codicon name="$(error)" className="diff-file-header-icon diff-file-header-icon-error" />
    ) : null;

  return (
    <div className="diff-part-container">
      {resolvedPath && (
        <div
          className="diff-file-header"
          {...(hasValidPath
            ? {
                role: 'button',
                tabIndex: 0,
                onClick: () => send({ type: 'file:open', path: resolvedPath }),
                onKeyDown: (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    send({ type: 'file:open', path: resolvedPath });
                  }
                },
              }
            : {})}
        >
          {statusIcon}
          <span className="diff-file-name" data-custom-title={resolvedPath}>
            {resolvedPath}
          </span>
        </div>
      )}
      <div className="diff-table-wrapper">
        <table className="diff-table">
          {segments.map((segment, segIdx) => {
            if (segment.type === 'visible') {
              const blocks = partitionLines(segment.lines);
              let lineCounter = 0;

              return blocks.map((block, blockIdx) => {
                const blockStartIdx = lineCounter;
                lineCounter += block.lines.length;
                const blockEndIdx = lineCounter - 1;

                if (block.type === 'change') {
                  const addedNewNumbers = block.lines
                    .filter((l) => l.type === 'added' && l.newLineNumber !== null)
                    .map((l) => l.newLineNumber as number);

                  const handleClick: (() => void) | null = hasValidPath
                    ? addedNewNumbers.length > 0
                      ? () => {
                          const minLine = Math.min(...addedNewNumbers);
                          const maxLine = Math.max(...addedNewNumbers);
                          send({
                            type: 'file:open',
                            path: resolvedPath,
                            startLine: minLine,
                            endLine: maxLine,
                          });
                        }
                      : () => {
                          const nearestLine = findNearestNewLineNumber(
                            segment.lines,
                            blockStartIdx,
                            blockEndIdx,
                          );
                          send({
                            type: 'file:open',
                            path: resolvedPath,
                            startLine: nearestLine,
                          });
                        }
                    : null;

                  const handleKeyDown = handleClick
                    ? (e: React.KeyboardEvent) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleClick();
                        }
                      }
                    : undefined;

                  return (
                    <tbody
                      key={`seg-${segIdx}-block-${blockIdx}`}
                      className="diff-change-block"
                      {...(handleClick
                        ? {
                            role: 'button',
                            tabIndex: 0,
                            onClick: handleClick,
                            onKeyDown: handleKeyDown,
                          }
                        : {})}
                    >
                      {block.lines.map((line, lineIdx) => (
                        <DiffLineRow key={lineKey(segIdx, blockStartIdx + lineIdx)} line={line} />
                      ))}
                    </tbody>
                  );
                } else {
                  return (
                    <tbody
                      key={`seg-${segIdx}-block-${blockIdx}`}
                      className={`diff-${block.type}-block`}
                    >
                      {block.lines.map((line, lineIdx) => (
                        <DiffLineRow key={lineKey(segIdx, blockStartIdx + lineIdx)} line={line} />
                      ))}
                    </tbody>
                  );
                }
              });
            }

            // Collapsed segment — check expansion state
            const expansion = expansionMap[segIdx] ?? { startExpanded: 0, endExpanded: 0 };
            const totalExpanded = expansion.startExpanded + expansion.endExpanded;

            if (totalExpanded >= segment.count) {
              // Fully expanded — render all lines
              return (
                <tbody key={`seg-${segIdx}-full-expanded`} className="diff-context-block">
                  {segment.lines.map((line, lineIdx) => (
                    <DiffLineRow key={lineKey(segIdx, lineIdx)} line={line} />
                  ))}
                </tbody>
              );
            }

            // Partially expanded — render start lines, collapsed block, end lines.
            // Stable per-line keys keep DOM identity across expansion changes.
            const startRows: React.ReactNode[] = [];
            const endRows: React.ReactNode[] = [];

            for (let lineIdx = 0; lineIdx < expansion.startExpanded; lineIdx++) {
              const line = segment.lines[lineIdx];
              startRows.push(<DiffLineRow key={lineKey(segIdx, lineIdx)} line={line} />);
            }

            const remainingCount = segment.count - totalExpanded;
            const collapsedBlockNode =
              remainingCount > 0 ? (
                <CollapsedBlock
                  key={`collapsed-${segIdx}`}
                  count={remainingCount}
                  onExpandStart={(n) => handleExpandStart(segIdx, n)}
                  onExpandEnd={(n) => handleExpandEnd(segIdx, n)}
                  onExpandAll={() => handleExpandAll(segIdx)}
                />
              ) : null;

            const endStart = segment.count - expansion.endExpanded;
            for (let lineIdx = endStart; lineIdx < segment.count; lineIdx++) {
              const line = segment.lines[lineIdx];
              endRows.push(<DiffLineRow key={lineKey(segIdx, lineIdx)} line={line} />);
            }

            const tbodies: React.ReactNode[] = [];
            if (startRows.length > 0) {
              tbodies.push(
                <tbody key={`seg-${segIdx}-start-expanded`} className="diff-context-block">
                  {startRows}
                </tbody>,
              );
            }
            if (collapsedBlockNode) {
              tbodies.push(
                <tbody key={`seg-${segIdx}-collapsed`} className="diff-collapsed-block">
                  {collapsedBlockNode}
                </tbody>,
              );
            }
            if (endRows.length > 0) {
              tbodies.push(
                <tbody key={`seg-${segIdx}-end-expanded`} className="diff-context-block">
                  {endRows}
                </tbody>,
              );
            }

            return tbodies;
          })}
        </table>
      </div>
    </div>
  );
}
