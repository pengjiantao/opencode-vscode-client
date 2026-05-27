/**
 * @file Modal confirmation dialog for the revert (undo) action.
 * Prevents accidental message rollbacks by requiring explicit user confirmation.
 */

import React from 'react';
import { Codicon } from './Codicon';

/** Props for the RevertConfirmDialog component. */
export interface RevertConfirmDialogProps {
  /** Whether the dialog is visible. */
  visible: boolean;
  /** Callback when the user confirms the revert. */
  onConfirm: () => void;
  /** Callback when the user cancels. */
  onCancel: () => void;
}

/**
 * Modal dialog asking the user to confirm reverting a message.
 * Renders as a centered overlay on top of the chat view.
 */
export function RevertConfirmDialog({ visible, onConfirm, onCancel }: RevertConfirmDialogProps) {
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
    <div className="revert-confirm-overlay" onClick={onCancel}>
      <div className="revert-confirm-dialog" ref={dialogRef} onClick={(e) => e.stopPropagation()}>
        <div className="revert-confirm-header">
          <Codicon name="warning" className="revert-confirm-icon" />
          <span>Revert Message</span>
        </div>
        <div className="revert-confirm-body">
          <p>
            This will revert this message and all subsequent messages, undoing any file changes made
            by the assistant.
          </p>
          <p>The message content will be restored to the input box.</p>
        </div>
        <div className="revert-confirm-actions">
          <button className="revert-confirm-btn cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="revert-confirm-btn confirm" onClick={onConfirm} autoFocus>
            Revert
          </button>
        </div>
      </div>
    </div>
  );
}
