/**
 * @file MentionPopover component displaying a list of files and directories for autocomplete.
 * Renders list items featuring type-specific icons and path descriptions, ensuring selected items are centered.
 */

import { useEffect, useRef } from 'react';
import { getIconClass } from '../utils/chipUtils';

/**
 * Properties accepted by the MentionPopover component.
 */
export interface MentionPopoverProps {
  /** Whether the popover list should be visible */
  show: boolean;
  /** List of workspace items returned from extension host search */
  results: Array<{
    name: string;
    relativePath: string;
    type: 'file' | 'dir';
    fsPath: string;
  }>;
  /** Current keyboard selected item index */
  selectedIndex: number;
  /** Callback fired when an item is selected by clicking */
  onSelect: (item: {
    name: string;
    relativePath: string;
    type: 'file' | 'dir';
    fsPath: string;
  }) => void;
}

/**
 * Renders the mention suggestion popover above the input editor.
 * Prevents default focus loss on mouse down to retain active cursor state.
 */
export function MentionPopover({ show, results, selectedIndex, onSelect }: MentionPopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep the currently keyboard-selected item centered in the visible scrollable area
  useEffect(() => {
    if (show && containerRef.current && selectedIndex >= 0) {
      const selectedEl = containerRef.current.querySelector(`.mention-item.selected`);
      if (selectedEl && typeof selectedEl.scrollIntoView === 'function') {
        selectedEl.scrollIntoView({
          behavior: 'auto',
          block: 'center',
          inline: 'nearest',
        });
      }
    }
  }, [selectedIndex, show, results]);

  if (!show) return null;

  return (
    <div
      ref={containerRef}
      className="mention-list-popover"
      onMouseDown={(e) => e.preventDefault()}
      data-testid="mention-popover"
    >
      {results.length > 0 ? (
        results.map((item, index) => {
          const iconClass = getIconClass('file', item.type === 'dir' ? 'directory' : 'text/plain');

          // Extract parent relative directory. Hide completely if in root directory.
          const parts = item.relativePath.split('/');
          const isRoot = parts.length <= 1;
          const parentDir = isRoot ? '' : parts.slice(0, -1).join('/');

          return (
            <div
              key={`${item.type}-${item.relativePath}`}
              className={`mention-item ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => onSelect(item)}
              data-testid={`mention-item-${index}`}
            >
              <span className="item-icon">
                <i className={`codicon codicon-${iconClass}`} />
              </span>
              <div className="item-info">
                <span className="item-name">{item.name}</span>
                {!isRoot && <span className="item-path">{parentDir}</span>}
              </div>
            </div>
          );
        })
      ) : (
        <div className="mention-no-results">No files or directories found</div>
      )}
    </div>
  );
}
