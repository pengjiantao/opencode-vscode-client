/**
 * @file Reusable icon button component with VS Code styles.
 */

import type { CSSProperties, MouseEvent } from 'react';
import { Codicon } from './Codicon';

/** Props for the IconButton component. */
export interface IconButtonProps {
  /** The icon identifier, e.g., 'close', 'ellipsis', or '$(close)'. */
  name: string;
  /** Click event handler. */
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  /** Hover tooltip text. */
  title?: string;
  /** Predefined size ('small', 'medium', 'large') or custom number (in pixels). Default is 'medium'. */
  size?: 'small' | 'medium' | 'large' | number;
  /** Optional custom CSS class names to apply to the button. */
  className?: string;
  /** If true, the button is disabled. */
  disabled?: boolean;
  /** Optional custom inline styles. */
  style?: CSSProperties;
}

/**
 * Reusable icon button configured with transparent background, native hover behavior,
 * and high accessibility supporting tooltip and keyboard events.
 */
export function IconButton({
  name,
  onClick,
  title,
  size = 'medium',
  className = '',
  disabled = false,
  style,
}: IconButtonProps) {
  // Determine standard size class or inline dimensions for custom sizes
  const isPredefinedSize = typeof size === 'string';
  const sizeClass = isPredefinedSize ? `icon-button-${size}` : '';

  // Construct custom style properties when a exact number is provided for size
  const combinedStyle: CSSProperties = {
    ...style,
    ...(!isPredefinedSize
      ? {
          width: `${size}px`,
          height: `${size}px`,
          fontSize: `${Math.round(size * 0.7)}px`,
        }
      : {}),
  };

  return (
    <button
      type="button"
      className={`icon-button ${sizeClass} ${className}`}
      onClick={onClick}
      data-custom-title={title}
      aria-label={title || name}
      disabled={disabled}
      style={combinedStyle}
    >
      <Codicon name={name} />
    </button>
  );
}
