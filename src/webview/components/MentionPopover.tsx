/**
 * @file MentionPopover component displaying a list of files and directories for autocomplete.
 * Wraps the generic SearchListPopover with file-specific icon and path rendering.
 */

import { Codicon } from './Codicon';
import { FileIcon } from './FileIcon';
import { SearchListPopover } from './SearchListPopover';

/** Shape of a workspace search result item from the extension host. */
export interface MentionItem {
  name: string;
  relativePath: string;
  type: 'file' | 'dir';
  fsPath: string;
}

/**
 * Properties accepted by the MentionPopover component.
 */
export interface MentionPopoverProps {
  /** Whether the popover list should be visible */
  show: boolean;
  /** List of workspace items returned from extension host search */
  results: MentionItem[];
  /** Current keyboard selected item index */
  selectedIndex: number;
  /** Callback fired when an item is selected by clicking */
  onSelect: (item: MentionItem) => void;
}

/**
 * Renders the mention suggestion popover above the input editor using the generic SearchListPopover.
 */
export function MentionPopover({ show, results, selectedIndex, onSelect }: MentionPopoverProps) {
  return (
    <SearchListPopover
      show={show}
      items={results}
      selectedIndex={selectedIndex}
      onSelect={onSelect}
      getKey={(item) => `${item.type}-${item.relativePath}`}
      renderItem={(item) => {
        const parts = item.relativePath.split('/');
        const isRoot = parts.length <= 1;
        const parentDir = isRoot ? '' : parts.slice(0, -1).join('/');

        return (
          <>
            <span className="item-icon">
              {item.type === 'dir' ? (
                <Codicon name="folder" />
              ) : (
                <FileIcon path={item.fsPath} size={16} className="item-icon-img" />
              )}
            </span>
            <div className="item-info">
              <span className="item-name">{item.name}</span>
              {!isRoot && <span className="item-path">{parentDir}</span>}
            </div>
          </>
        );
      }}
      emptyText="No files or directories found"
      testId="mention-popover"
    />
  );
}
