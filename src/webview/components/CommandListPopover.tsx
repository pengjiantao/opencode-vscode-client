/**
 * @file CommandListPopover component displaying a searchable list of server built-in commands and skills.
 * Wraps the generic SearchListPopover with command/skill-specific icon and description rendering.
 */

import { getCommandIconClass } from '../utils/chipUtils';
import { SearchListPopover } from './SearchListPopover';

/** Unified item type merging commands and skills for display. */
export interface CommandListItem {
  name: string;
  description?: string;
  source: 'command' | 'mcp' | 'skill';
}

/**
 * Properties accepted by the CommandListPopover component.
 */
export interface CommandListPopoverProps {
  /** Whether the popover list should be visible */
  show: boolean;
  /** Currently displayed (pre-filtered) command and skill items */
  results: CommandListItem[];
  /** Current keyboard selected item index */
  selectedIndex: number;
  /** Callback fired when an item is selected */
  onSelect: (item: CommandListItem) => void;
  /** Whether the current trigger context is skills-only (mid-text /) */
  skillsOnly: boolean;
}

/**
 * Renders the command/skill search popover above the input editor.
 * Each item is displayed with a source-specific codicon, name, and truncated description.
 */
export function CommandListPopover({
  show,
  results,
  selectedIndex,
  onSelect,
  skillsOnly,
}: CommandListPopoverProps) {
  return (
    <SearchListPopover
      show={show}
      items={results}
      selectedIndex={selectedIndex}
      onSelect={onSelect}
      getKey={(item) => `${item.source}-${item.name}`}
      renderItem={(item) => {
        const iconClass = getCommandIconClass(item.source);
        return (
          <>
            <span className="item-icon">
              <i className={`codicon codicon-${iconClass}`} />
            </span>
            <div className="item-info">
              <span className="item-name">{item.name}</span>
              {item.description && <span className="item-description">{item.description}</span>}
            </div>
          </>
        );
      }}
      emptyText={skillsOnly ? 'No matching skills found' : 'No matching commands or skills found'}
      testId="command-popover"
    />
  );
}
