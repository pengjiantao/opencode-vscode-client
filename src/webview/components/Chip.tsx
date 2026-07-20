/**
 * @file Interactive Chip component representing pasted or attached files, images, and text snippets.
 * Renders with type-specific icons, details, rich theme-adaptive React hover tooltips,
 * and support for dismissing/removing and click-to-open file operations.
 */

import React, { useEffect } from 'react';
import { useIPC } from '../hooks/useIPC';
import { useSessionStore } from '../store/sessionStore';
import {
  getChipDisplayLabel,
  getCommandIconClass,
  getIconClass,
  getTooltipContent,
} from '../utils/chipUtils';
import { useTooltipContent } from '../utils/tooltipContentRegistry';
import { Codicon } from './Codicon';
import { FileIcon } from './FileIcon';

/**
 * Properties accepted by the Chip component.
 */
export interface ChipProps {
  /** The type of data represented by the chip. */
  type: 'file' | 'image' | 'text' | 'code-selection' | 'terminal' | 'command' | 'skill';
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
  /** Number of lines for pasted text snippets or terminal logs. */
  linesCount?: number;
  /** Start line number of the code selection. */
  startLine?: number;
  /** End line number of the code selection. */
  endLine?: number;
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
  startLine,
  endLine,
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

  /** Renders the leading icon for the chip. Directory mime types and other
   *  non-file types fall back to codicons; file types with a real path get
   *  the per-extension SVG icon. */
  const renderIcon = () => {
    // Directory mime types always render the folder codicon regardless of type.
    if (mime === 'directory' || mime === 'application/x-directory') {
      return <Codicon name="folder" />;
    }
    // File/code-selection with a real path get the per-extension icon.
    if ((type === 'file' || type === 'code-selection') && path) {
      return <FileIcon path={path} size={14} className="chip-icon-img" />;
    }
    const cls =
      type === 'command'
        ? getCommandIconClass(mime)
        : type === 'skill'
          ? getIconClass('skill')
          : getIconClass(type, mime);
    return <Codicon name={`$(${cls})`} />;
  };

  /** Handles click events, sending open file IPC commands for workspace files. */
  const handleClick = (e: React.MouseEvent) => {
    if (type === 'file' && path) {
      const resolvedInfo = cachedInfo || { isWorkspace: isWorkspace || false };
      if (resolvedInfo.isWorkspace) {
        send({ type: 'file:open', path });
        e.stopPropagation();
      }
    } else if (type === 'code-selection' && path) {
      send({ type: 'file:open', path, startLine, endLine });
      e.stopPropagation();
    }
  };

  const isClickable =
    (type === 'file' && (cachedInfo?.isWorkspace || isWorkspace)) ||
    (type === 'code-selection' && !!path);

  const displayLabel = getChipDisplayLabel(type, filename, linesCount, startLine, endLine, text);
  const tooltipContent = getTooltipContent(
    {
      type,
      filename,
      path,
      text,
      size,
      mime,
      isWorkspace,
      dataUrl,
      linesCount,
      startLine,
      endLine,
    },
    fileInfos || {},
  );
  const tooltipContentId = useTooltipContent(tooltipContent);

  return (
    <span
      className={`opencode-chip ${type}-chip ${isClickable ? 'clickable' : ''}`}
      onClick={handleClick}
      data-custom-title-content={tooltipContentId}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      <span className="chip-icon">{renderIcon()}</span>
      <span className="chip-label">{displayLabel}</span>
    </span>
  );
}
