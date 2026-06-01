/**
 * @file Renders a structured, syntax-aware or color-coded diff view for file modifications.
 * Context lines far from changes are folded, showing 3 lines of context around each change.
 * Supports per-segment directional expansion (first 10 / last 10 / all).
 */

import { memo, useCallback, useMemo, useState } from 'react';
import type { WebviewToExt } from '../../../shared/types';
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
 * Renders a single diff line as a table row.
 *
 * Memoized: re-renders are skipped when line reference and click handler
 * stay the same. Line references are stable thanks to the parseDiff cache,
 * and the click handler is memoized below.
 */
const DiffLineRow = memo(function DiffLineRow({
  line,
  hasValidPath,
  handleClick,
}: {
  line: DiffLine;
  hasValidPath: boolean;
  handleClick: (() => void) | null;
}) {
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

  const handleKeyDown = handleClick
    ? (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }
    : undefined;

  return (
    <tr
      className={rowClass}
      {...(hasValidPath
        ? {
            role: 'button',
            tabIndex: 0,
            onClick: handleClick ?? undefined,
            onKeyDown: handleKeyDown,
          }
        : {})}
    >
      <td className="diff-line-num old-num">{displayOld}</td>
      <td className="diff-line-num new-num">{displayNew}</td>
      <td className="diff-sign">{sign}</td>
      <td className="diff-code">{line.content}</td>
    </tr>
  );
});

/**
 * Builds a memoized click handler for a single line. The handler is stable
 * across renders whenever the line and resolvedPath are stable, so the
 * memoized DiffLineRow can skip re-rendering unchanged rows.
 */
function useLineClickHandler(
  line: DiffLine,
  hasValidPath: boolean,
  resolvedPath: string,
  send: (msg: WebviewToExt) => void,
): (() => void) | null {
  return useMemo(() => {
    if (!hasValidPath) return null;

    if (line.type === 'added' && line.newLineNumber !== null) {
      return () => {
        send({
          type: 'file:open',
          path: resolvedPath,
          startLine: line.newLineNumber!,
          endLine: line.newLineNumber!,
        });
      };
    }
    if (line.type === 'removed' && line.oldLineNumber !== null) {
      return () => {
        send({ type: 'file:open', path: resolvedPath, startLine: line.oldLineNumber! });
      };
    }
    if (line.type === 'context' && line.newLineNumber !== null) {
      return () => {
        send({ type: 'file:open', path: resolvedPath, startLine: line.newLineNumber! });
      };
    }
    return null;
    // send reference is stable from useIPC.
  }, [line, hasValidPath, resolvedPath, send]);
}

/**
 * Renders a unified diff in a tabular structure with separate line numbers
 * and change symbols. Context lines far from changes are folded by default,
 * showing 3 lines of context around each change. Supports per-segment
 * directional expansion.
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
          <tbody>
            {segments.map((segment, segIdx) => {
              if (segment.type === 'visible') {
                return segment.lines.map((line, lineIdx) => (
                  <DiffLineWithHandler
                    key={lineKey(segIdx, lineIdx)}
                    line={line}
                    hasValidPath={hasValidPath}
                    resolvedPath={resolvedPath}
                    send={send}
                  />
                ));
              }

              // Collapsed segment — check expansion state
              const expansion = expansionMap[segIdx] ?? { startExpanded: 0, endExpanded: 0 };
              const totalExpanded = expansion.startExpanded + expansion.endExpanded;

              if (totalExpanded >= segment.count) {
                // Fully expanded — render all lines
                return segment.lines.map((line, lineIdx) => (
                  <DiffLineWithHandler
                    key={lineKey(segIdx, lineIdx)}
                    line={line}
                    hasValidPath={hasValidPath}
                    resolvedPath={resolvedPath}
                    send={send}
                  />
                ));
              }

              // Partially expanded — render start lines, collapsed block, end lines.
              // Stable per-line keys keep DOM identity across expansion changes.
              const rows: React.ReactNode[] = [];

              for (let lineIdx = 0; lineIdx < expansion.startExpanded; lineIdx++) {
                const line = segment.lines[lineIdx];
                rows.push(
                  <DiffLineWithHandler
                    key={lineKey(segIdx, lineIdx)}
                    line={line}
                    hasValidPath={hasValidPath}
                    resolvedPath={resolvedPath}
                    send={send}
                  />,
                );
              }

              const remainingCount = segment.count - totalExpanded;
              if (remainingCount > 0) {
                rows.push(
                  <CollapsedBlock
                    key={`collapsed-${segIdx}`}
                    count={remainingCount}
                    onExpandStart={(n) => handleExpandStart(segIdx, n)}
                    onExpandEnd={(n) => handleExpandEnd(segIdx, n)}
                    onExpandAll={() => handleExpandAll(segIdx)}
                  />,
                );
              }

              const endStart = segment.count - expansion.endExpanded;
              for (let lineIdx = endStart; lineIdx < segment.count; lineIdx++) {
                const line = segment.lines[lineIdx];
                rows.push(
                  <DiffLineWithHandler
                    key={lineKey(segIdx, lineIdx)}
                    line={line}
                    hasValidPath={hasValidPath}
                    resolvedPath={resolvedPath}
                    send={send}
                  />,
                );
              }

              return rows;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Thin wrapper that pairs a line with its memoized click handler. Defined
 * outside the main component so the hook order is consistent across renders.
 */
function DiffLineWithHandler({
  line,
  hasValidPath,
  resolvedPath,
  send,
}: {
  line: DiffLine;
  hasValidPath: boolean;
  resolvedPath: string;
  send: (msg: WebviewToExt) => void;
}) {
  const handleClick = useLineClickHandler(line, hasValidPath, resolvedPath, send);
  return <DiffLineRow line={line} hasValidPath={hasValidPath} handleClick={handleClick} />;
}
