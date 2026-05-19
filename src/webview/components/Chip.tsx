/**
 * @file Interactive Chip component representing pasted or attached files, images, and text snippets.
 * Renders with type-specific icons, details, rich theme-adaptive HTML hover tooltips,
 * and support for dismissing/removing and click-to-open file operations.
 */

import React, { useEffect } from 'react';
import { useIPC } from '../hooks/useIPC';
import { useSessionStore } from '../store/sessionStore';
import { getIconClass, getTooltipHtml } from '../utils/chipUtils';
import { Codicon } from './Codicon';

/**
 * Properties accepted by the Chip component.
 */
export interface ChipProps {
  /** The type of data represented by the chip. */
  type: 'file' | 'image' | 'text';
  /** Display name of the chip (filename or description). */
  filename?: string;
  /** Absolute file path or URL on the local disk. */
  path?: string;
  /** Direct text content for snippets or files. */
  text?: string;
  /** Size of the file in bytes. */
  size?: number;
  /** MIME type of the file. */
  mime?: string;
  /** Whether the file is located within the active workspace folders. */
  isWorkspace?: boolean;
  /** Base64 Data URL or remote source URL for image elements. */
  dataUrl?: string;
  /** Number of lines for pasted text snippets. */
  linesCount?: number;
  /** Callback to trigger when the dismiss icon button is clicked. */
  onRemove?: () => void;
}

/**
 * Interactive Chip component for rendering files, images, and text snippets.
 * Displays type-specific icons, handles click-to-open actions, and declares a custom hover tooltip.
 */
export function Chip({
  type,
  filename,
  path,
  text,
  size,
  mime,
  isWorkspace,
  dataUrl,
  linesCount,
  onRemove,
}: ChipProps) {
  const { send } = useIPC(() => {});
  const fileInfos = useSessionStore((s) => s.fileInfos);

  // Retrieve cached file query details if it's a file chip and we have a path
  const cachedInfo = type === 'file' && path && fileInfos ? fileInfos[path] : undefined;

  // Trigger file information query when mounted if not already present in Central Cache
  useEffect(() => {
    if (type === 'file' && path && !cachedInfo) {
      send({ type: 'file:query', path });
    }
  }, [type, path, cachedInfo, send]);

  /** Determines the VS Code codicon name based on the attachment type. */
  const getIconName = (): string => `$(${getIconClass(type, mime)})`;

  /** Handles click events, sending open file IPC commands for workspace files. */
  const handleClick = (e: React.MouseEvent) => {
    if (type === 'file' && path) {
      const resolvedInfo = cachedInfo || { isWorkspace: isWorkspace || false };
      if (resolvedInfo.isWorkspace) {
        send({ type: 'file:open', path });
        e.stopPropagation();
      }
    }
  };

  const isClickable = type === 'file' && (cachedInfo?.isWorkspace || isWorkspace);
  const displayLabel =
    type === 'text'
      ? `Pasted ${linesCount || text?.split('\n').length || 1} Lines`
      : filename || 'file';

  return (
    <span
      className={`opencode-chip ${type}-chip ${isClickable ? 'clickable' : ''}`}
      onClick={handleClick}
      data-custom-title={getTooltipHtml(
        { type, filename, path, text, size, mime, isWorkspace, dataUrl, linesCount },
        fileInfos || {},
      )}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      <span className="chip-icon">
        <Codicon name={getIconName()} />
      </span>
      <span className="chip-label">{displayLabel}</span>
      {onRemove && (
        <button
          className="chip-remove-btn"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label="Remove attachment"
        >
          <Codicon name="$(close)" />
        </button>
      )}
    </span>
  );
}
