/**
 * @file StatusBarManager.
 * Manages the native VS Code Status Bar Item to reflect OpenCode session processing statuses.
 */

import type { SessionStatus } from '@opencode-ai/sdk/v2/client';
import {
  StatusBarAlignment,
  ThemeColor,
  window,
  type ExtensionContext,
  type StatusBarItem,
} from 'vscode';
import type { SessionManager } from './session-manager';

/**
 * Manages the native VS Code Status Bar Item lifecycle and visual state.
 */
export class StatusBarManager {
  private readonly statusBarItem: StatusBarItem;
  private readonly sessionStatuses: Map<string, SessionStatus>;
  private readonly sessionManager: SessionManager;

  /**
   * Creates a StatusBarManager instance.
   * @param context VS Code ExtensionContext.
   * @param sessionManager The session manager instance.
   * @param sessionStatuses Map of session IDs to their current processing status.
   */
  constructor(
    context: ExtensionContext,
    sessionManager: SessionManager,
    sessionStatuses: Map<string, SessionStatus>,
  ) {
    this.sessionStatuses = sessionStatuses;
    this.sessionManager = sessionManager;

    // Initialize native status bar item to show current session processing status
    this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 100);
    this.statusBarItem.name = 'OpenCode Status';
    this.statusBarItem.command = 'opencode-sidebar.focus';
    this.statusBarItem.text = '$(circle-outline) OpenCode: Ready';
    this.statusBarItem.tooltip = 'OpenCode is idle and ready';
    this.statusBarItem.show();
    context.subscriptions.push(this.statusBarItem);

    // Keep status bar in sync when active session changes, registering a disposable for clean cleanup
    const unsubscribeActiveSession = sessionManager.subscribe(() => {
      this.update();
    });
    context.subscriptions.push({ dispose: unsubscribeActiveSession });
  }

  /**
   * Updates the native status bar item's styling and text to match
   * the active session's latest processing state.
   */
  public update(): void {
    const activeSessionID = this.sessionManager.activeSessionID;
    if (!activeSessionID) {
      this.statusBarItem.hide();
      return;
    }

    const status = this.sessionStatuses.get(activeSessionID);
    if (!status || status.type === 'idle') {
      this.statusBarItem.text = '$(circle-outline) OpenCode: Ready';
      this.statusBarItem.tooltip = `Session: ${activeSessionID}\nStatus: Ready`;
      this.statusBarItem.backgroundColor = undefined;
    } else if (status.type === 'busy') {
      this.statusBarItem.text = '$(sync~spin) OpenCode: Processing...';
      this.statusBarItem.tooltip = `Session: ${activeSessionID}\nStatus: Processing`;
      this.statusBarItem.backgroundColor = undefined;
    } else if (status.type === 'retry') {
      this.statusBarItem.text = `$(warning) OpenCode: Retrying (${status.attempt}/${status.next})`;
      this.statusBarItem.tooltip = `Session: ${activeSessionID}\nStatus: Retrying...\nMessage: ${status.message || 'None'}`;
      this.statusBarItem.backgroundColor = new ThemeColor('statusBarItem.warningBackground');
    }
    this.statusBarItem.show();
  }
}
