/**
 * @file Reusable Select (Combobox) component using the generic Popover.
 * Implements a true combobox pattern: the keyboard-highlighted item is purely
 * visual until the user commits it with Enter or a mouse click.
 */

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Codicon } from './Codicon';
import { Popover } from './Popover';

/** Structure for options in the Select component. */
export interface SelectOption {
  /** Unique identifier for the option. */
  id: string;
  /** Human-readable name/label displayed in the list. */
  label: string;
  /** Optional category group name. Options are grouped by this field if provided. */
  group?: string;
}

/** Props for the Select component. */
export interface SelectProps {
  /** Array of select options. */
  options: SelectOption[];
  /** Currently selected option ID. */
  value: string;
  /** Callback fired when the selection changes. */
  onChange: (value: string) => void;
  /** Placeholder text for the search input. Defaults to 'Search...'. */
  placeholder?: string;
  /** If true, includes a text input at the top of the popover to filter options. Defaults to false. */
  searchable?: boolean;
  /** Custom trigger button display text. If omitted, falls back to the active option's label. */
  triggerText?: string;
  /** If true, the select is disabled and displays a loading state. */
  isLoading?: boolean;
  /** Text to show in trigger during loading. Defaults to 'Loading...'. */
  loadingText?: string;
  /** Text to show when search returns zero results. Defaults to 'No results found'. */
  noResultsText?: string;
  /** Placement direction of the popover menu. Defaults to 'top' (ideal for bottom-anchored selectors). */
  placement?: 'top' | 'bottom';
  /** Custom CSS class for the select container. */
  className?: string;
  /** Custom CSS class for the popover element. */
  popoverClassName?: string;
  /** Accessibility label for the combobox trigger button. */
  ariaLabel?: string;
  /** Optional icon to render inside the trigger button before text. */
  icon?: ReactNode;
}

/** Props for the popover body sub-component. */
interface SelectPopoverBodyProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  searchable: boolean;
  placeholder: string;
  noResultsText: string;
}

/**
 * Popover body sub-component. Owns the search/filter/keyboard-navigation state.
 *
 * It is rendered as the children of `Popover`, which conditionally mounts it
 * based on the popover's open state. This means the body component (re)mounts
 * on every popover open, so transient state like the keyboard highlight is
 * automatically reset to the committed `value` on each open — no cross-render
 * state synchronization required.
 */
function SelectPopoverBody({
  options,
  value,
  onChange,
  onClose,
  searchable,
  placeholder,
  noResultsText,
}: SelectPopoverBodyProps) {
  const [searchQuery, setSearchQuery] = useState('');
  // Transient keyboard-highlighted option id. `null` means "no override; use the real `value`".
  // Reset to `null` on each mount (handled implicitly by useState initial value).
  const [keyboardActiveId, setKeyboardActiveId] = useState<string | null>(null);
  const optionsListRef = useRef<HTMLDivElement>(null);

  // Filter options by search query
  const filteredOptions = useMemo(() => {
    if (!searchable || !searchQuery) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        (opt.group && opt.group.toLowerCase().includes(query)),
    );
  }, [options, searchQuery, searchable]);

  // Group options by group name if provided, otherwise place in standard list
  const groups: Record<string, SelectOption[]> = {};
  const ungrouped: SelectOption[] = [];

  filteredOptions.forEach((opt) => {
    if (opt.group) {
      if (!groups[opt.group]) {
        groups[opt.group] = [];
      }
      groups[opt.group].push(opt);
    } else {
      ungrouped.push(opt);
    }
  });

  // The effective highlight id is derived from state, not stored separately.
  // Priority: keyboardActiveId if still in the filtered list (user has navigated
  // and the item is visible), else value if in the list (the committed selection
  // shown on open), else the first filtered option (snap-on-search behavior when
  // the current selection is excluded by a query).
  const effectiveHighlightId = useMemo(() => {
    if (filteredOptions.length === 0) return null;
    if (keyboardActiveId !== null && filteredOptions.some((o) => o.id === keyboardActiveId)) {
      return keyboardActiveId;
    }
    if (filteredOptions.some((o) => o.id === value)) {
      return value;
    }
    return filteredOptions[0].id;
  }, [keyboardActiveId, filteredOptions, value]);

  // Center the effective highlight in the options list whenever it changes. We
  // deliberately avoid `scrollIntoView()` because it cascades to all scrollable
  // ancestors and would shift the entire webview; manual `scrollTop` math keeps
  // the scroll contained to the dropdown list.
  useEffect(() => {
    if (!effectiveHighlightId || !optionsListRef.current) return;
    const container = optionsListRef.current;
    const selectedEl = container.querySelector<HTMLElement>(
      `.select-option[data-option-id="${CSS.escape(effectiveHighlightId)}"]`,
    );
    if (!selectedEl) return;
    const desired = selectedEl.offsetTop - container.clientHeight / 2 + selectedEl.offsetHeight / 2;
    const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
    container.scrollTop = Math.max(0, Math.min(desired, maxScroll));
  }, [effectiveHighlightId, filteredOptions]);

  const handleOptionCommit = (id: string) => {
    if (id !== value) {
      onChange(id);
    }
    // No need to reset searchQuery here — the body component is about to unmount
    // (onClose flips Popover's isOpen, which removes the children subtree).
    onClose();
  };

  const handleKeyDownOnSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredOptions.length === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = filteredOptions.findIndex((o) => o.id === effectiveHighlightId);
      const safeIdx = idx < 0 ? 0 : idx;
      const next =
        e.key === 'ArrowDown'
          ? (safeIdx + 1) % filteredOptions.length
          : (safeIdx - 1 + filteredOptions.length) % filteredOptions.length;
      setKeyboardActiveId(filteredOptions[next].id);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Commit the visual highlight (which already accounts for the snap-to-first
      // rule); Enter on the already-committed value is a no-op for business logic.
      const target = effectiveHighlightId ?? value;
      if (target && target !== value) {
        onChange(target);
      }
      onClose();
    }
    // Letter keys and other inputs fall through to update searchQuery normally.
  };

  return (
    <div className="select-popover-content">
      {searchable && (
        <div className="select-search-container">
          <input
            type="text"
            className="select-search-input"
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDownOnSearch}
            autoFocus
          />
        </div>
      )}
      <div className="select-options-list" role="listbox" ref={optionsListRef}>
        {filteredOptions.length === 0 ? (
          <div className="select-no-results">{noResultsText}</div>
        ) : (
          <>
            {/* Render grouped options */}
            {Object.entries(groups).map(([groupName, groupOptions]) => (
              <div key={groupName} className="select-group" role="group" aria-label={groupName}>
                <div className="select-group-header">{groupName}</div>
                {groupOptions.map((opt) => (
                  <SelectOptionRow
                    key={opt.id}
                    option={opt}
                    isHighlighted={opt.id === effectiveHighlightId}
                    isCommitted={opt.id === value}
                    onCommit={handleOptionCommit}
                  />
                ))}
              </div>
            ))}

            {/* Render ungrouped options */}
            {ungrouped.map((opt) => (
              <SelectOptionRow
                key={opt.id}
                option={opt}
                isHighlighted={opt.id === effectiveHighlightId}
                isCommitted={opt.id === value}
                onCommit={handleOptionCommit}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/** Props for a single selectable row inside the popover list. */
interface SelectOptionRowProps {
  option: SelectOption;
  isHighlighted: boolean;
  isCommitted: boolean;
  onCommit: (id: string) => void;
}

/**
 * Single option row. Renders a `<div role="option">` with the label and an
 * optional check icon for the committed selection. Extracted to remove the
 * duplication between the grouped and ungrouped render paths.
 */
function SelectOptionRow({ option, isHighlighted, isCommitted, onCommit }: SelectOptionRowProps) {
  return (
    <div
      role="option"
      aria-selected={isHighlighted}
      data-option-id={option.id}
      className={`select-option ${isHighlighted ? 'selected' : ''}`}
      onClick={() => onCommit(option.id)}
    >
      <span className="select-option-name" data-custom-title={option.label}>
        {option.label}
      </span>
      {isCommitted && <span className="select-check-icon">✓</span>}
    </div>
  );
}

/**
 * Reusable Select component that styles a combobox trigger and list popup.
 * Connects with `Popover` and delegates search, filtering, keyboard navigation,
 * and scroll-centering to a sub-component that resets its state on every open.
 */
export function Select({
  options,
  value,
  onChange,
  placeholder = 'Search...',
  searchable = false,
  triggerText,
  isLoading = false,
  loadingText = 'Loading...',
  noResultsText = 'No results found',
  placement = 'top',
  className = '',
  popoverClassName = '',
  ariaLabel,
  icon,
}: SelectProps) {
  // Find currently active option to determine trigger label if not custom
  const activeOption = options.find((opt) => opt.id === value);
  const resolvedTriggerText = activeOption ? activeOption.label : value;
  const displayLabel = isLoading ? loadingText : triggerText || resolvedTriggerText || 'Select...';

  return (
    <Popover
      placement={placement}
      className={`select-container ${className}`}
      popoverClassName={`select-popover ${popoverClassName}`}
      trigger={
        <button
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-label={ariaLabel}
          disabled={isLoading}
          className="select-trigger"
        >
          {icon && <span className="select-trigger-icon">{icon}</span>}
          <span className="select-trigger-text" data-custom-title={displayLabel}>
            {displayLabel}
          </span>
          <Codicon name="chevron-down" className="select-trigger-chevron" />
        </button>
      }
    >
      {({ close }) => (
        <SelectPopoverBody
          options={options}
          value={value}
          onChange={onChange}
          onClose={close}
          searchable={searchable}
          placeholder={placeholder}
          noResultsText={noResultsText}
        />
      )}
    </Popover>
  );
}
