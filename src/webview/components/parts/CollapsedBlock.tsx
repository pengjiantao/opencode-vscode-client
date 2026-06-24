/**
 * @file Collapsed block indicator for folded context lines in a diff view.
 * Shows the count of hidden lines as a clickable button (expand all),
 * with two stacked +10 expand buttons: top for first 10, bottom for last 10.
 */

/** Props for the CollapsedBlock component. */
export interface CollapsedBlockProps {
  /** Number of collapsed context lines. */
  count: number;
  /**
   * Number of columns the row should span. The diff table is 4 columns
   * wide when the line-number gutter is shown, and 2 columns wide when
   * the gutter is hidden (tool-rendered diffs). The collapsed row must
   * match the table's column count so the layout stays aligned.
   */
  colSpan: number;
  /** Callback to expand the first N lines from the start. */
  onExpandStart: (n: number) => void;
  /** Callback to expand the last N lines from the end. */
  onExpandEnd: (n: number) => void;
  /** Callback to expand all hidden lines. */
  onExpandAll: () => void;
}

const EXPAND_STEP = 10;

/**
 * Renders a collapsed block indicator between visible diff segments.
 * Top button expands first 10 lines, bottom button expands last 10 lines.
 * The count label is clickable to expand all.
 */
export function CollapsedBlock({
  count,
  colSpan,
  onExpandStart,
  onExpandEnd,
  onExpandAll,
}: CollapsedBlockProps) {
  const canExpandStart = count > 0;
  const canExpandEnd = count > 1;

  return (
    <tr className="diff-collapsed-row">
      <td colSpan={colSpan} className="diff-collapsed-cell">
        <div className="diff-collapsed-indicator">
          <button
            className="diff-collapsed-count-btn"
            onClick={(e) => {
              e.stopPropagation();
              onExpandAll();
            }}
            title="Expand all hidden lines"
            type="button"
          >
            +{count} more lines
          </button>
          <div className="diff-collapsed-actions-stacked">
            {canExpandStart && (
              <button
                className="diff-expand-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onExpandStart(EXPAND_STEP);
                }}
                title={`Expand first ${EXPAND_STEP} lines`}
                type="button"
              >
                +{EXPAND_STEP}
              </button>
            )}
            {canExpandEnd && (
              <button
                className="diff-expand-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onExpandEnd(EXPAND_STEP);
                }}
                title={`Expand last ${EXPAND_STEP} lines`}
                type="button"
              >
                +{EXPAND_STEP}
              </button>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
