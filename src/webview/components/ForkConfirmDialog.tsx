/**
 * @file Modal confirmation dialog for the fork session action.
 * Prevents accidental session forks by requiring explicit user confirmation.
 */

import { ConfirmDialog } from './ConfirmDialog';

/** Props for the ForkConfirmDialog component. */
export interface ForkConfirmDialogProps {
  /** Whether the dialog is visible. */
  visible: boolean;
  /** Fork mode: entire session or from a specific message. */
  mode: 'session' | 'message';
  /** Callback when the user confirms the fork. */
  onConfirm: () => void;
  /** Callback when the user cancels. */
  onCancel: () => void;
}

/**
 * Modal dialog asking the user to confirm forking a session.
 * Renders as a centered overlay on top of the chat view.
 * Supports two modes: forking the entire session or forking at a specific message.
 */
export function ForkConfirmDialog({ visible, mode, onConfirm, onCancel }: ForkConfirmDialogProps) {
  const isSession = mode === 'session';

  return (
    <ConfirmDialog
      visible={visible}
      icon="repo-forked"
      iconClassName="confirm-icon-fork"
      title={isSession ? 'Fork Session' : 'Fork from Message'}
      confirmText="Fork"
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {isSession ? (
        <>
          <p>This will create a copy of the entire session with all messages.</p>
          <p>You will be switched to the new forked session.</p>
        </>
      ) : (
        <>
          <p>
            This will create a copy of the session up to this message, excluding all subsequent
            messages.
          </p>
          <p>The message content will be restored to the input box.</p>
        </>
      )}
    </ConfirmDialog>
  );
}
