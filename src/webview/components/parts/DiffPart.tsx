/**
 * @file Renders a structured, syntax-aware or color-coded diff view for file modifications.
 * Context lines far from changes are folded by default, showing 3 lines of context around
 * each change. When `expandAll` is true, folding is skipped and all lines are rendered.
 * Supports per-segment directional expansion (first 10 / last 10 / all).
 */

import { memo, useCallback, useMemo, useState } from 'react';
import { useIPC } from '../../hooks/useIPC';
import { useSessionStore } from '../../store/sessionStore';
import type { DiffSegment } from '../../utils/diff-fold';
import { buildSegments } from '../../utils/diff-fold';
import type { DiffLine } from '../../utils/diff-parser';
import { parseDiff } from '../../utils/diff-parser';
import { toDisplayPath } from '../../utils/path-utils';
import { FileIcon } from '../FileIcon';
import { ScrollFadeContainer } from '../ScrollFadeContainer';
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
  /**
   * When true, all lines are rendered without folding. Used in the chat area
   * where diffs are shown inline and folding is undesirable. Defaults to false.
   */
  expandAll?: boolean;
  /**
   * Whether to render the gutter columns with old/new line numbers.
   *
   * - `true` (default): the review page and any other standalone diff
   *   surface — the gutter gives reviewers immediate range context.
   * - `false`: tool-rendered diffs (e.g. edit / apply_patch tool output in
   *   the chat stream) where the horizontal space is at a premium and
   *   hunk headers already carry the range information.
   */
  showLineNumbers?: boolean;
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
 *
 * When `showLineNumbers` is true (default), the row carries four cells:
 * old-num, new-num, sign, code. When false (tool-rendered diffs), only
 * sign and code are rendered, reclaiming the horizontal space the gutter
 * would have occupied. Hunk headers always span the full table width.
 */
const DiffLineRow = memo(function DiffLineRow({
  line,
  showLineNumbers,
  colSpan,
}: {
  line: DiffLine;
  showLineNumbers: boolean;
  colSpan: number;
}) {
  if (isHunkHeaderLine(line)) {
    return (
      <tr className="diff-hunk-header-row">
        <td colSpan={colSpan} className="diff-hunk-header">
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

  const sign = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
  const displayOld = line.oldLineNumber !== null ? String(line.oldLineNumber) : '';
  const displayNew = line.newLineNumber !== null ? String(line.newLineNumber) : '';

  if (showLineNumbers) {
    return (
      <tr className={rowClass}>
        <td className="diff-line-num old-num">{displayOld}</td>
        <td className="diff-line-num new-num">{displayNew}</td>
        <td className="diff-sign">{sign}</td>
        <td className="diff-code">{line.content}</td>
      </tr>
    );
  }

  return (
    <tr className={rowClass}>
      <td className="diff-sign">{sign}</td>
      <td className="diff-code">{line.content}</td>
    </tr>
  );
});

/**
 * Renders a unified diff in a tabular structure. The table always has a
 * change-sign column and a code column. A line-number gutter (old / new)
 * is included by default and can be hidden via `showLineNumbers={false}`
 * — typically when the diff is rendered inline by a tool result and the
 * hunk header (`@@ -a,b +c,d @@`) is already on screen for range context.
 * Context lines far from changes are folded by default, showing 3 lines
 * of context around each change. Supports per-segment directional
 * expansion. Contiguous modifications are grouped into interactive
 * tbody blocks. Long lines never wrap — the table grows to fit its
 * widest row and the surrounding `diff-table-xscroll` wrapper provides
 * horizontal scrolling.
 */
export function DiffPart({
  diff,
  filePath,
  expandAll = false,
  showLineNumbers = true,
}: DiffPartProps) {
  const { send } = useIPC(() => {});
  const workspaceRoot = useSessionStore((s) => s.workspaceRoot);
  const parsed = useMemo(() => parseDiff(diff), [diff]);

  // Total visible columns in the diff table. The two line-number columns
  // (old-num, new-num) are omitted in tool-rendered diffs.
  const tableColSpan = showLineNumbers ? 4 : 2;

  const resolvedPath = filePath || parsed.newFile;
  const hasValidPath =
    !!resolvedPath && resolvedPath !== '/dev/null' && resolvedPath !== 'dev/null';

  /** Display path: relative if within workspace, absolute otherwise. */
  const displayPath = useMemo(
    () => toDisplayPath(resolvedPath || '', workspaceRoot),
    [resolvedPath, workspaceRoot],
  );

  const segments = useMemo(() => {
    if (expandAll) {
      // Flatten all hunks into a single visible segment with hunk headers interspersed
      const allLines: DiffLine[] = [];
      for (const hunk of parsed.hunks) {
        allLines.push({
          type: 'context',
          content: hunk.header,
          oldLineNumber: null,
          newLineNumber: null,
        });
        allLines.push(...hunk.lines);
      }
      return allLines.length > 0
        ? ([{ type: 'visible' as const, lines: allLines }] as DiffSegment[])
        : [];
    }
    return buildSegments(parsed.hunks, DEFAULT_CONTEXT_LINES);
  }, [parsed.hunks, expandAll]);

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
          <FileIcon path={resolvedPath} size={14} />
          <span className="diff-file-name" data-custom-title={resolvedPath}>
            {displayPath}
          </span>
        </div>
      )}
      <ScrollFadeContainer className="diff-table-wrapper" contentClassName="diff-table-content">
        <div className="diff-table-xscroll">
          <table className={`diff-table${showLineNumbers ? ' diff-table-with-gutter' : ''}`}>
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
                          <DiffLineRow
                            key={lineKey(segIdx, blockStartIdx + lineIdx)}
                            line={line}
                            showLineNumbers={showLineNumbers}
                            colSpan={tableColSpan}
                          />
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
                          <DiffLineRow
                            key={lineKey(segIdx, blockStartIdx + lineIdx)}
                            line={line}
                            showLineNumbers={showLineNumbers}
                            colSpan={tableColSpan}
                          />
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
                      <DiffLineRow
                        key={lineKey(segIdx, lineIdx)}
                        line={line}
                        showLineNumbers={showLineNumbers}
                        colSpan={tableColSpan}
                      />
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
                startRows.push(
                  <DiffLineRow
                    key={lineKey(segIdx, lineIdx)}
                    line={line}
                    showLineNumbers={showLineNumbers}
                    colSpan={tableColSpan}
                  />,
                );
              }

              const remainingCount = segment.count - totalExpanded;
              const collapsedBlockNode =
                remainingCount > 0 ? (
                  <CollapsedBlock
                    key={`collapsed-${segIdx}`}
                    count={remainingCount}
                    colSpan={tableColSpan}
                    onExpandStart={(n) => handleExpandStart(segIdx, n)}
                    onExpandEnd={(n) => handleExpandEnd(segIdx, n)}
                    onExpandAll={() => handleExpandAll(segIdx)}
                  />
                ) : null;

              const endStart = segment.count - expansion.endExpanded;
              for (let lineIdx = endStart; lineIdx < segment.count; lineIdx++) {
                const line = segment.lines[lineIdx];
                endRows.push(
                  <DiffLineRow
                    key={lineKey(segIdx, lineIdx)}
                    line={line}
                    showLineNumbers={showLineNumbers}
                    colSpan={tableColSpan}
                  />,
                );
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
      </ScrollFadeContainer>
    </div>
  );
}
