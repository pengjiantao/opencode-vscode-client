/**
 * @file Renders a file-type icon SVG by file path. Falls back to a generic
 * codicon when the curated Material Icon Theme subset has no match.
 */

import type { CSSProperties } from 'react';
import { getFileIconUrl } from '../utils/file-icons';
import { Codicon } from './Codicon';

/** Props for the FileIcon component. */
export interface FileIconProps {
  /** Absolute or relative file path used to resolve the icon. */
  path?: string;
  /** Width and height in pixels. Defaults to 16. */
  size?: number;
  /** Alt text for screen readers. Leave empty for purely decorative icons. */
  alt?: string;
  /** Optional extra CSS class names appended to the wrapper / fallback. */
  className?: string;
  /** Optional inline styles applied to the rendered element. */
  style?: CSSProperties;
}

/**
 * Resolves a file path to a Material Icon Theme SVG and renders it as an
 * `<img>`. When no icon matches, renders a generic `<Codicon name="file" />`
 * fallback so the layout remains stable.
 */
export function FileIcon({ path, size = 16, alt = '', className, style }: FileIconProps) {
  const url = getFileIconUrl(path);
  if (url) {
    return (
      <img
        src={url}
        width={size}
        height={size}
        alt={alt}
        aria-hidden={alt ? undefined : true}
        className={className}
        style={style}
        draggable={false}
      />
    );
  }
  return (
    <Codicon
      name="file"
      className={className}
      style={{ fontSize: size, width: size, height: size, ...style }}
    />
  );
}
