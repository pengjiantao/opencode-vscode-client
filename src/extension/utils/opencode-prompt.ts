/**
 * @file Friendly recovery prompt for "opencode binary not found".
 * Surfaces a VS Code notification with action buttons that walk the user
 * through the most common recovery paths: open settings, copy install command,
 * open install docs, or reload the window after fixing the issue.
 */

import { commands, env, Uri, window } from 'vscode';
import { buildNotFoundMessage, type ResolvedBinary } from './opencode-path';

/** Command id for the VS Code "open settings" action, parameterized by setting key. */
const OPEN_SETTINGS_COMMAND = 'workbench.action.openSettings';
/** Command id for reloading the VS Code window (re-runs activate with the new config). */
const RELOAD_WINDOW_COMMAND = 'workbench.action.reloadWindow';
/** Canonical install script URL surfaced in the prompt. */
const INSTALL_COMMAND = 'curl -fsSL https://opencode.ai/install | bash';
/** URL of the opencode installation documentation. */
const INSTALL_DOCS_URL = 'https://opencode.ai/docs/';
/** Markdown link appended to the notification explaining the user can re-run after fixing. */
const RECOVERY_HINT = 'Set `opencode.executablePath` or install opencode, then reload the window.';

/** Action labels displayed in the notification. */
const ACTION_OPEN_SETTINGS = 'Open Settings';
const ACTION_COPY_INSTALL = 'Copy install command';
const ACTION_OPEN_DOCS = 'Open install docs';
const ACTION_RETRY = 'Retry';

/**
 * Computes the action-button labels in the order they will be presented.
 * Exposed for unit testing without invoking the notification UI.
 *
 * @returns Ordered array of button labels.
 */
export function getPromptActions(): string[] {
  return [ACTION_OPEN_SETTINGS, ACTION_COPY_INSTALL, ACTION_OPEN_DOCS, ACTION_RETRY];
}

/**
 * Builds the user-facing notification text. The detail combines the underlying
 * reason with a recovery hint and is the single string passed to
 * `window.showErrorMessage`.
 *
 * @param resolved A `none` result from {@link import('./opencode-path').resolveOpencodeBinary}.
 * @returns The detail string to display in the notification.
 */
export function buildPromptContent(
  resolved: Extract<ResolvedBinary, { source: 'none' }>,
): string {
  return `${buildNotFoundMessage(resolved)} ${RECOVERY_HINT}`;
}

/**
 * Shows a friendly VS Code notification describing why the opencode binary could
 * not be found and offering the standard recovery actions. The underlying error
 * is also logged via `console.error` for diagnostic purposes.
 *
 * The function never throws; UI errors are caught and reported silently.
 *
 * @param resolved A `none` result from {@link import('./opencode-path').resolveOpencodeBinary}.
 * @param error Optional underlying error (logged for diagnostics).
 */
export async function showOpencodeNotFoundPrompt(
  resolved: Extract<ResolvedBinary, { source: 'none' }>,
  error?: unknown,
): Promise<void> {
  if (error !== undefined) {
    // Diagnostic log; UI surfaces the friendly version only.
    console.error('[opencode] binary resolution failed:', error);
  }

  const detail = buildPromptContent(resolved);
  const actions = getPromptActions();

  let selection: string | undefined;
  try {
    // showErrorMessage returns the label of the clicked button, or undefined if dismissed.
    selection = await window.showErrorMessage(detail, { modal: false }, ...actions);
  } catch (err) {
    console.error('[opencode] failed to display not-found prompt:', err);
    return;
  }

  if (!selection) return;

  try {
    switch (selection) {
      case ACTION_OPEN_SETTINGS:
        await commands.executeCommand(OPEN_SETTINGS_COMMAND, 'opencode.executablePath');
        break;
      case ACTION_COPY_INSTALL:
        await env.clipboard.writeText(INSTALL_COMMAND);
        void window.showInformationMessage(`Copied to clipboard: ${INSTALL_COMMAND}`);
        break;
      case ACTION_OPEN_DOCS:
        await env.openExternal(Uri.parse(INSTALL_DOCS_URL));
        break;
      case ACTION_RETRY:
        await commands.executeCommand(RELOAD_WINDOW_COMMAND);
        break;
    }
  } catch (err) {
    console.error(`[opencode] failed to handle prompt action "${selection}":`, err);
  }
}
