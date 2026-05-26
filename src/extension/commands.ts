/**
 * @file Command registrations for OpenCode sidebar extension.
 */

import * as path from 'path';
import { commands, env, window, type ExtensionContext } from 'vscode';
import { IPCBridge } from './ipc';
import { OpencodeSidebarViewProvider } from './webview-provider';

/**
 * Registers all editor, terminal, and session management commands.
 *
 * @param context The extension context.
 * @param ipc The extension IPC bridge.
 * @param provider The webview sidebar view provider.
 * @param handleCreateSession Callback to create a new session.
 * @param handleSelectHistory Callback to show select history QuickPick.
 * @param handleCloseAll Callback to close all sessions.
 */
export function registerExtensionCommands(
  context: ExtensionContext,
  ipc: IPCBridge,
  provider: OpencodeSidebarViewProvider,
  handleCreateSession: () => void,
  handleSelectHistory: () => void,
  handleCloseAll: () => void,
): void {
  context.subscriptions.push(
    commands.registerCommand('opencode-sidebar.focus', () => {
      provider.view?.show(true);
    }),
  );

  context.subscriptions.push(
    commands.registerCommand('opencode-sidebar.createSession', () => {
      handleCreateSession();
    }),
  );

  context.subscriptions.push(
    commands.registerCommand('opencode-sidebar.showHistory', () => {
      handleSelectHistory();
    }),
  );

  context.subscriptions.push(
    commands.registerCommand('opencode-sidebar.closeAllSessions', () => {
      handleCloseAll();
    }),
  );

  context.subscriptions.push(
    commands.registerCommand('opencode-sidebar.openSettings', () => {
      ipc.send({ type: 'settings:open' });
    }),
  );

  context.subscriptions.push(
    commands.registerCommand('opencode-sidebar.pasteAsPlainText', async () => {
      await pasteClipboardTextAsPlainText(ipc);
    }),
  );

  context.subscriptions.push(
    commands.registerCommand('opencode-sidebar.sendSelectionToOpencode', () => {
      const editor = window.activeTextEditor;
      if (!editor) return;
      const selection = editor.selection;
      if (selection.isEmpty) return;
      const text = editor.document.getText(selection);
      const filename = path.basename(editor.document.fileName);
      const filePath = editor.document.fileName;
      const startLine = selection.start.line + 1;
      const endLine = selection.end.line + 1;

      ipc.send({
        type: 'editor:selection',
        text,
        filename,
        path: filePath,
        startLine,
        endLine,
        action: 'insert',
      });
      // Bring sidebar to focus to ensure immediate visibility of the inserted chip
      provider.view?.show(true);
    }),
  );

  context.subscriptions.push(
    commands.registerCommand('opencode-sidebar.explainSelectionToOpencode', () => {
      const editor = window.activeTextEditor;
      if (!editor) return;
      const selection = editor.selection;
      if (selection.isEmpty) return;
      const text = editor.document.getText(selection);
      const filename = path.basename(editor.document.fileName);
      const filePath = editor.document.fileName;
      const startLine = selection.start.line + 1;
      const endLine = selection.end.line + 1;

      ipc.send({
        type: 'editor:selection',
        text,
        filename,
        path: filePath,
        startLine,
        endLine,
        action: 'explain',
      });
      // Bring sidebar to focus to ensure immediate visibility of the inserted chip
      provider.view?.show(true);
    }),
  );

  context.subscriptions.push(
    commands.registerCommand('opencode-sidebar.sendTerminalToOpencode', async () => {
      const editor = window.activeTextEditor;
      let text: string | undefined;
      // Prefer output editor selection directly if the active editor is the output channel
      if (editor && editor.document.uri.scheme === 'output') {
        const selection = editor.selection;
        if (!selection.isEmpty) {
          text = editor.document.getText(selection);
        }
      }
      if (!text) {
        text = await copyTerminalSelectionSafely();
      }
      if (!text) {
        void window.showInformationMessage(
          'No active selection found in terminal or output panel.',
        );
        return;
      }
      const linesCount = text.split(/\r?\n/).length;
      ipc.send({
        type: 'terminal:selection',
        text,
        linesCount,
        action: 'insert',
      });
      // Bring sidebar to focus to ensure immediate visibility of the inserted chip
      provider.view?.show(true);
    }),
  );

  context.subscriptions.push(
    commands.registerCommand('opencode-sidebar.explainTerminalToOpencode', async () => {
      const editor = window.activeTextEditor;
      let text: string | undefined;
      // Prefer output editor selection directly if the active editor is the output channel
      if (editor && editor.document.uri.scheme === 'output') {
        const selection = editor.selection;
        if (!selection.isEmpty) {
          text = editor.document.getText(selection);
        }
      }
      if (!text) {
        text = await copyTerminalSelectionSafely();
      }
      if (!text) {
        void window.showInformationMessage(
          'No active selection found in terminal or output panel.',
        );
        return;
      }
      const linesCount = text.split(/\r?\n/).length;
      ipc.send({
        type: 'terminal:selection',
        text,
        linesCount,
        action: 'explain-fix',
      });
      // Bring sidebar to focus to ensure immediate visibility of the inserted chip
      provider.view?.show(true);
    }),
  );
}

/**
 * Reads the native VS Code clipboard and sends its current text to the prompt editor.
 *
 * @param ipc The bridge used to deliver the plain text insertion message.
 */
export async function pasteClipboardTextAsPlainText(ipc: IPCBridge): Promise<void> {
  const text = await env.clipboard.readText();
  if (!text) return;
  ipc.send({
    type: 'editor:paste-plain-text',
    text,
  });
}

/**
 * Safely copies the active terminal selection to clipboard, resolves race condition,
 * and restores the user's original clipboard content immediately.
 *
 * @returns The copied terminal selection string, or undefined if no selection was captured.
 */
async function copyTerminalSelectionSafely(): Promise<string | undefined> {
  let originalClipboard = '';
  try {
    originalClipboard = await env.clipboard.readText();
  } catch {
    // Ignore read errors if clipboard is empty/inaccessible
  }

  // Use a highly unique token to detect clipboard changes reliably
  const uniqueToken = `opencode-terminal-copy-placeholder-${Date.now()}-${Math.random()}`;
  try {
    await env.clipboard.writeText(uniqueToken);
  } catch {
    // If writing to clipboard fails or is blocked, abort to avoid further side-effects
    return undefined;
  }

  // Trigger terminal copy selection action asynchronously
  await commands.executeCommand('workbench.action.terminal.copySelection');

  let text: string | undefined;
  // Poll clipboard value up to 10 times with 50ms interval (500ms total timeout)
  // to resolve the copy action propagation race condition.
  for (let i = 0; i < 10; i++) {
    try {
      const current = await env.clipboard.readText();
      if (current !== uniqueToken) {
        text = current;
        break;
      }
    } catch {
      // Ignore intermediate read failures
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  // Restore the user's original clipboard content to prevent overwriting/destruction
  try {
    await env.clipboard.writeText(originalClipboard);
  } catch {
    // Ignore restore write failures
  }

  return text;
}
