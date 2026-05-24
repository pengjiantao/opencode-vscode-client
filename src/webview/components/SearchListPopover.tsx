/**
 * @file Generic searchable list popover component abstracted from MentionPopover.
 * Renders a scrollable list with keyboard-selected item centering and empty state.
 * Used by MentionPopover (file/directory search) and CommandListPopover (command/skill search).
 */

import { useEffect, useRef } from 'react';

/**
 * Properties accepted by the SearchListPopover generic component.
 */
export interface SearchListPopoverProps<T> {
  /** Whether the popover list should be visible */
  show: boolean;
  /** List of items to display */
  items: T[];
  /** Current keyboard selected item index */
  selectedIndex: number;
  /** Callback fired when an item is selected by clicking */
  onSelect: (item: T) => void;
  /** Extracts a unique key from each item for React key and querySelector lookup */
  getKey: (item: T) => string;
  /** Renders a single item row; receives the item, its index, and whether it is selected */
  renderItem: (item: T, index: number, isSelected: boolean) => React.ReactNode;
  /** Text shown when the items array is empty */
  emptyText: string;
  /** Optional additional CSS class for the popover container */
  className?: string;
  /** Optional data-testid for the popover root element */
  testId?: string;
}

/**
 * Generic search-list popover rendering a scrollable overlay above the input.
 * Keeps the currently keyboard-selected item centered and prevents default focus loss.
 */
export function SearchListPopover<T>({
  show,
  items,
  selectedIndex,
  onSelect,
  getKey,
  renderItem,
  emptyText,
  className = '',
  testId = 'search-list-popover',
}: SearchListPopoverProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (show && containerRef.current && selectedIndex >= 0 && items.length > 0) {
      const key = getKey(items[selectedIndex]);
      const selectedEl = containerRef.current.querySelector<HTMLElement>(
        `.search-list-item[data-item-key="${CSS.escape(key)}"]`,
      );

      if (selectedEl && containerRef.current) {
        const container = containerRef.current;
        const offsetTop = selectedEl.offsetTop;
        const itemHeight = selectedEl.offsetHeight;
        const containerHeight = container.clientHeight;
        const containerScrollTop = container.scrollTop;

        // NOTE: We do not use `selectedEl.scrollIntoView()` here because it inherently
        // tries to scroll ALL scrollable ancestor containers (including the document body/webview)
        // to center the element, which causes the entire webview layout to shift upwards.
        // Instead, we manually calculate and update the `scrollTop` of the dropdown container
        // to ensure the selected item is just visible within the list bounds.
        if (offsetTop < containerScrollTop) {
          container.scrollTop = offsetTop;
        } else if (offsetTop + itemHeight > containerScrollTop + containerHeight) {
          container.scrollTop = offsetTop + itemHeight - containerHeight;
        }
      }
    }
  }, [selectedIndex, show, items, getKey]);

  if (!show) return null;

  return (
    <div
      ref={containerRef}
      className={`search-list-popover ${className}`}
      onMouseDown={(e) => e.preventDefault()}
      data-testid={testId}
    >
      {items.length > 0 ? (
        items.map((item, index) => {
          const key = getKey(item);
          const isSelected = index === selectedIndex;
          return (
            <div
              key={key}
              className={`search-list-item ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelect(item)}
              data-item-key={key}
              data-testid={`${testId}-item-${index}`}
            >
              {renderItem(item, index, isSelected)}
            </div>
          );
        })
      ) : (
        <div className="search-list-no-results">{emptyText}</div>
      )}
    </div>
  );
}
