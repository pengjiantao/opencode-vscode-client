/**
 * @file Renders a structured, syntax-aware or color-coded diff view for file modifications.
 */

import { useIPC } from '../../hooks/useIPC';
import { parseDiff } from '../../utils/diff-parser';

interface DiffPartProps {
  /** The raw unified diff string to render. */
  diff: string;
  /** Optional file path to show context. */
  filePath?: string;
}

/**
 * Extracts the starting line number for the modified file from a unified hunk header.
 * E.g., extracts 10 from "@@ -8,3 +10,4 @@".
 *
 * @param header The hunk header string to parse.
 * @returns The starting line number of the new/modified file block, or null if parsing fails.
 */
function getHunkNewStart(header: string): number | null {
  // Match the new file line range specification (+start,length) in the hunk header.
  // We use this to resolve the line number to jump to when a hunk header is clicked.
  const match = header.match(/@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Renders a unified diff in a tabular structure with separate line numbers
 * and change symbols. Fits natively within VS Code's design system.
 */
export function DiffPart({ diff, filePath }: DiffPartProps) {
  const { send } = useIPC(() => {});
  const parsed = parseDiff(diff);

  const resolvedPath = filePath || parsed.newFile;
  const hasValidPath = resolvedPath && resolvedPath !== '/dev/null' && resolvedPath !== 'dev/null';

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
          <span className="diff-file-name">{resolvedPath}</span>
        </div>
      )}
      <div className="diff-table-wrapper">
        <table className="diff-table">
          <tbody>
            {parsed.hunks.flatMap((hunk, hunkIdx) => {
              const newStartLine = getHunkNewStart(hunk.header);

              return [
                <tr
                  key={`hunk-header-${hunkIdx}`}
                  className="diff-hunk-header-row"
                  {...(hasValidPath && newStartLine !== null
                    ? {
                        role: 'button',
                        tabIndex: 0,
                        onClick: (e) => {
                          e.stopPropagation();
                          send({
                            type: 'file:open',
                            path: resolvedPath,
                            startLine: newStartLine,
                          });
                        },
                        onKeyDown: (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            send({
                              type: 'file:open',
                              path: resolvedPath,
                              startLine: newStartLine,
                            });
                          }
                        },
                      }
                    : {})}
                >
                  <td colSpan={4} className="diff-hunk-header">
                    {hunk.header}
                  </td>
                </tr>,
                ...hunk.lines.map((line, lineIdx) => {
                  const rowClass =
                    line.type === 'added'
                      ? 'diff-row-added'
                      : line.type === 'removed'
                        ? 'diff-row-removed'
                        : 'diff-row-context';

                  // Render blank markers instead of zeros for cleaner visual tracking
                  const displayOld = line.oldLineNumber !== null ? String(line.oldLineNumber) : '';
                  const displayNew = line.newLineNumber !== null ? String(line.newLineNumber) : '';
                  const sign = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';

                  const handleLineClick = () => {
                    if (!hasValidPath) return;

                    if (line.type === 'added' && line.newLineNumber !== null) {
                      // Highlight/select added lines since they represent new workspace additions
                      send({
                        type: 'file:open',
                        path: resolvedPath,
                        startLine: line.newLineNumber,
                        endLine: line.newLineNumber,
                      });
                    } else if (line.type === 'removed' && line.oldLineNumber !== null) {
                      // Navigate to the location in the file where the line was removed
                      send({
                        type: 'file:open',
                        path: resolvedPath,
                        startLine: line.oldLineNumber,
                      });
                    } else if (line.type === 'context' && line.newLineNumber !== null) {
                      // Jump to the context line position in the new/current document state
                      send({
                        type: 'file:open',
                        path: resolvedPath,
                        startLine: line.newLineNumber,
                      });
                    }
                  };

                  const handleLineKeyDown = (e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleLineClick();
                    }
                  };

                  return (
                    <tr
                      key={`hunk-${hunkIdx}-line-${lineIdx}`}
                      className={rowClass}
                      {...(hasValidPath
                        ? {
                            role: 'button',
                            tabIndex: 0,
                            onClick: handleLineClick,
                            onKeyDown: handleLineKeyDown,
                          }
                        : {})}
                    >
                      <td className="diff-line-num old-num">{displayOld}</td>
                      <td className="diff-line-num new-num">{displayNew}</td>
                      <td className="diff-sign">{sign}</td>
                      <td className="diff-code">{line.content}</td>
                    </tr>
                  );
                }),
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
