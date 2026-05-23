/**
 * @file Renders a structured, syntax-aware or color-coded diff view for file modifications.
 */

import { parseDiff } from '../../utils/diff-parser';

interface DiffPartProps {
  /** The raw unified diff string to render. */
  diff: string;
  /** Optional file path to show context. */
  filePath?: string;
}

/**
 * Renders a unified diff in a tabular structure with separate line numbers
 * and change symbols. Fits natively within VS Code's design system.
 */
export function DiffPart({ diff, filePath }: DiffPartProps) {
  const parsed = parseDiff(diff);

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
      {filePath && (
        <div className="diff-file-header">
          <span className="diff-file-name">{filePath}</span>
        </div>
      )}
      <div className="diff-table-wrapper">
        <table className="diff-table">
          <tbody>
            {parsed.hunks.flatMap((hunk, hunkIdx) => [
              <tr key={`hunk-header-${hunkIdx}`}>
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

                return (
                  <tr key={`hunk-${hunkIdx}-line-${lineIdx}`} className={rowClass}>
                    <td className="diff-line-num old-num">{displayOld}</td>
                    <td className="diff-line-num new-num">{displayNew}</td>
                    <td className="diff-sign">{sign}</td>
                    <td className="diff-code">{line.content}</td>
                  </tr>
                );
              }),
            ])}
          </tbody>
        </table>
      </div>
    </div>
  );
}
