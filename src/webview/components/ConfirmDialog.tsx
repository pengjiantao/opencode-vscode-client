/**
 * @file Generic modal confirmation dialog.
 * Provides a reusable overlay dialog with customizable icon, title, body, and confirm button text.
 */

import React from 'react';
import { Codicon } from './Codicon';

/** Props for the ConfirmDialog component. */
export interface ConfirmDialogProps {
  /** Whether the dialog is visible. */
  visible: boolean;
  /** Codicon icon name displayed in the header. */
  icon: string;
  /** CSS class for the icon (for color styling). */
  iconClassName?: string;
  /** Dialog title text. */
  title: string;
  /** Dialog body content. */
  children: React.ReactNode;
  /** Text for the confirm action button. */
  confirmText: string;
  /** Callback when the user confirms. */
  onConfirm: () => void;
  /** Callback when the user cancels. */
  onCancel: () => void;
}

/**
 * Generic modal confirmation dialog with overlay.
 * Handles Escape key and overlay click for dismissal.
 */
export function ConfirmDialog({
  visible,
  icon,
  iconClassName,
  title,
  children,
  confirmText,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, onCancel]);

  if (!visible) return null;

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-dialog" ref={dialogRef} onClick={(e) => e.stopPropagation()}>
        <div className="confirm-header">
          <Codicon name={icon} className={iconClassName} />
          <span>{title}</span>
        </div>
        <div className="confirm-body">{children}</div>
        <div className="confirm-actions">
          <button className="confirm-btn cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="confirm-btn confirm" onClick={onConfirm} autoFocus>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
