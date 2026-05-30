/**
 * @file Renders a structured, syntax-aware or color-coded diff view for file modifications.
 * Context lines far from changes are folded, showing 3 lines of context around each change.
 * Supports per-segment directional expansion (first 10 / last 10 / all).
 */

import { useMemo, useState } from 'react';
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
 * Renders a single diff line as a table row.
 */
function DiffLineRow({
  line,
  segKey,
  hasValidPath,
  resolvedPath,
  send,
}: {
  line: DiffLine;
  segKey: string;
  hasValidPath: boolean;
  resolvedPath: string;
  send: (msg: WebviewToExt) => void;
}) {
  if (isHunkHeaderLine(line)) {
    return (
      <tr key={segKey} className="diff-hunk-header-row">
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

  const handleClick = () => {
    if (!hasValidPath) return;

    if (line.type === 'added' && line.newLineNumber !== null) {
      send({
        type: 'file:open',
        path: resolvedPath,
        startLine: line.newLineNumber,
        endLine: line.newLineNumber,
      });
    } else if (line.type === 'removed' && line.oldLineNumber !== null) {
      send({ type: 'file:open', path: resolvedPath, startLine: line.oldLineNumber });
    } else if (line.type === 'context' && line.newLineNumber !== null) {
      send({ type: 'file:open', path: resolvedPath, startLine: line.newLineNumber });
    }
  };

  return (
    <tr
      key={segKey}
      className={rowClass}
      {...(hasValidPath
        ? {
            role: 'button',
            tabIndex: 0,
            onClick: handleClick,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
              }
            },
          }
        : {})}
    >
      <td className="diff-line-num old-num">{displayOld}</td>
      <td className="diff-line-num new-num">{displayNew}</td>
      <td className="diff-sign">{sign}</td>
      <td className="diff-code">{line.content}</td>
    </tr>
  );
}

/**
 * Renders a unified diff in a tabular structure with separate line numbers
 * and change symbols. Context lines far from changes are folded by default,
 * showing 3 lines of context around each change. Supports per-segment
 * directional expansion.
 */
export function DiffPart({ diff, filePath, status }: DiffPartProps) {
  const { send } = useIPC(() => {});
  const parsed = parseDiff(diff);

  const resolvedPath = filePath || parsed.newFile;
  const hasValidPath =
    !!resolvedPath && resolvedPath !== '/dev/null' && resolvedPath !== 'dev/null';

  const segments = useMemo(
    () => buildSegments(parsed.hunks, DEFAULT_CONTEXT_LINES),
    [parsed.hunks],
  );

  // Per-collapsed-segment expansion state: how many lines expanded from start and end
  const [expansionMap, setExpansionMap] = useState<Record<number, SegmentExpansion>>({});

  const handleExpandStart = (segIdx: number, n: number) => {
    setExpansionMap((prev) => {
      const current = prev[segIdx] ?? { startExpanded: 0, endExpanded: 0 };
      return { ...prev, [segIdx]: { ...current, startExpanded: current.startExpanded + n } };
    });
  };

  const handleExpandEnd = (segIdx: number, n: number) => {
    setExpansionMap((prev) => {
      const current = prev[segIdx] ?? { startExpanded: 0, endExpanded: 0 };
      return { ...prev, [segIdx]: { ...current, endExpanded: current.endExpanded + n } };
    });
  };

  const handleExpandAll = (segIdx: number) => {
    const seg = segments[segIdx];
    if (seg.type !== 'collapsed') return;
    const totalCount = seg.count;
    setExpansionMap((prev) => {
      return { ...prev, [segIdx]: { startExpanded: totalCount, endExpanded: 0 } };
    });
  };

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
                  <DiffLineRow
                    key={`seg-${segIdx}-line-${lineIdx}`}
                    line={line}
                    segKey={`seg-${segIdx}-line-${lineIdx}`}
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
                  <DiffLineRow
                    key={`seg-${segIdx}-exp-${lineIdx}`}
                    line={line}
                    segKey={`seg-${segIdx}-exp-${lineIdx}`}
                    hasValidPath={hasValidPath}
                    resolvedPath={resolvedPath}
                    send={send}
                  />
                ));
              }

              // Partially expanded — render start lines, collapsed block, end lines
              const startLines = segment.lines.slice(0, expansion.startExpanded);
              const remainingCount = segment.count - totalExpanded;
              const endLines = segment.lines.slice(segment.count - expansion.endExpanded);

              const rows: React.ReactNode[] = [];

              // Render expanded start lines
              startLines.forEach((line, lineIdx) => {
                rows.push(
                  <DiffLineRow
                    key={`seg-${segIdx}-start-${lineIdx}`}
                    line={line}
                    segKey={`seg-${segIdx}-start-${lineIdx}`}
                    hasValidPath={hasValidPath}
                    resolvedPath={resolvedPath}
                    send={send}
                  />,
                );
              });

              // Render remaining collapsed block
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

              // Render expanded end lines
              endLines.forEach((line, lineIdx) => {
                rows.push(
                  <DiffLineRow
                    key={`seg-${segIdx}-end-${lineIdx}`}
                    line={line}
                    segKey={`seg-${segIdx}-end-${lineIdx}`}
                    hasValidPath={hasValidPath}
                    resolvedPath={resolvedPath}
                    send={send}
                  />,
                );
              });

              return rows;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
