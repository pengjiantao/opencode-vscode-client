/**
 * @file Reusable Select (Combobox) component using the generic Popover.
 */

import { ReactNode, useState } from 'react';
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

/**
 * Reusable Select component that styles a combobox trigger and list popup.
 * Connects with `Popover` and handles searching, grouping, and active selections.
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
  const [searchQuery, setSearchQuery] = useState('');

  // Find currently active option to determine trigger label if not custom
  const activeOption = options.find((opt) => opt.id === value);
  const resolvedTriggerText = activeOption ? activeOption.label : value;
  const displayLabel = isLoading ? loadingText : triggerText || resolvedTriggerText || 'Select...';

  // Filter options by search query
  const filteredOptions = options.filter((opt) => {
    if (!searchable || !searchQuery) {
      return true;
    }
    const query = searchQuery.toLowerCase();
    return (
      opt.label.toLowerCase().includes(query) ||
      (opt.group && opt.group.toLowerCase().includes(query))
    );
  });

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
        <div className="select-popover-content">
          {searchable && (
            <div className="select-search-container">
              <input
                type="text"
                className="select-search-input"
                placeholder={placeholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>
          )}
          <div className="select-options-list" role="listbox">
            {filteredOptions.length === 0 ? (
              <div className="select-no-results">{noResultsText}</div>
            ) : (
              <>
                {/* Render grouped options */}
                {Object.entries(groups).map(([groupName, groupOptions]) => (
                  <div key={groupName} className="select-group" role="group" aria-label={groupName}>
                    <div className="select-group-header">{groupName}</div>
                    {groupOptions.map((opt) => (
                      <div
                        key={opt.id}
                        role="option"
                        aria-selected={opt.id === value}
                        className={`select-option ${opt.id === value ? 'selected' : ''}`}
                        onClick={() => {
                          onChange(opt.id);
                          setSearchQuery('');
                          close();
                        }}
                      >
                        <span className="select-option-name" data-custom-title={opt.label}>
                          {opt.label}
                        </span>
                        {opt.id === value && <span className="select-check-icon">✓</span>}
                      </div>
                    ))}
                  </div>
                ))}

                {/* Render ungrouped options */}
                {ungrouped.map((opt) => (
                  <div
                    key={opt.id}
                    role="option"
                    aria-selected={opt.id === value}
                    className={`select-option ${opt.id === value ? 'selected' : ''}`}
                    onClick={() => {
                      onChange(opt.id);
                      setSearchQuery('');
                      close();
                    }}
                  >
                    <span className="select-option-name" data-custom-title={opt.label}>
                      {opt.label}
                    </span>
                    {opt.id === value && <span className="select-check-icon">✓</span>}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </Popover>
  );
}
