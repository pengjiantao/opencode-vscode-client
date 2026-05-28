/**
 * @file Modal confirmation dialog for the revert (undo) action.
 * Prevents accidental message rollbacks by requiring explicit user confirmation.
 */

import { ConfirmDialog } from './ConfirmDialog';

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
  return (
    <div className="revert-confirm-wrapper">
      <ConfirmDialog
        visible={visible}
        icon="warning"
        iconClassName="confirm-icon-revert"
        title="Revert Message"
        confirmText="Revert"
        onConfirm={onConfirm}
        onCancel={onCancel}
      >
        <p>
          This will revert this message and all subsequent messages, undoing any file changes made
          by the assistant.
        </p>
        <p>The message content will be restored to the input box.</p>
      </ConfirmDialog>
    </div>
  );
}
