/**
 * @file Command registrations for OpenCode sidebar extension.
 */

import * as path from 'path';
import {
  commands,
  env,
  QuickPickItemKind,
  ThemeIcon,
  window,
  type ExtensionContext,
  type QuickInputButton,
  type QuickPickItem,
} from 'vscode';
import { IPCBridge } from './ipc';
import type { SDKClient } from './sdk-client';
import type { ModelInfo } from './types';
import { getConfiguration, setConfiguration } from './utils/config';
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
 * @param handleForkSession Callback to fork the active session.
 * @param sdk The SDK client.
 */
export function registerExtensionCommands(
  context: ExtensionContext,
  ipc: IPCBridge,
  provider: OpencodeSidebarViewProvider,
  handleCreateSession: () => void,
  handleSelectHistory: () => void,
  handleCloseAll: () => void,
  handleForkSession: () => void,
  sdk: SDKClient,
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
    commands.registerCommand('opencode-sidebar.forkSession', () => {
      handleForkSession();
    }),
  );

  context.subscriptions.push(
    commands.registerCommand('opencode-sidebar.openSettings', () => {
      void showDefaultSettingsQuickPick(sdk);
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

/**
 * Shows a QuickPick to choose which default setting to configure
 * (model, agent, or opencode executable path).
 */
export async function showDefaultSettingsQuickPick(sdk: SDKClient): Promise<void> {
  const config = getConfiguration();

  interface SettingPickItem extends QuickPickItem {
    setting: 'model' | 'agent' | 'executablePath';
  }

  const items: SettingPickItem[] = [
    {
      label: '$(robot) Default Model',
      description: config.model || '(not set)',
      setting: 'model',
    },
    {
      label: '$(terminal) Default Agent',
      description: config.agent || '(not set)',
      setting: 'agent',
    },
    {
      label: '$(file-binary) OpenCode Executable',
      description: config.executablePath || '(use PATH)',
      setting: 'executablePath',
    },
  ];

  const quickPick = window.createQuickPick<SettingPickItem>();
  quickPick.title = 'OpenCode Settings';
  quickPick.placeholder = 'Select a setting to configure';
  quickPick.items = items;

  const result = await new Promise<SettingPickItem | undefined>((resolve) => {
    quickPick.onDidAccept(() => {
      const selected = quickPick.selectedItems[0];
      quickPick.hide();
      resolve(selected);
    });
    quickPick.onDidHide(() => {
      if (quickPick.selectedItems.length === 0) {
        resolve(undefined);
      }
      quickPick.dispose();
    });
    quickPick.show();
  });

  if (!result) return;

  if (result.setting === 'model') {
    await showModelQuickPick(sdk);
  } else if (result.setting === 'agent') {
    await showAgentQuickPick(sdk);
  } else {
    await showExecutablePathQuickPick();
  }
}

/**
 * Shows a native open dialog so the user can pick the opencode executable
 * file. Filters the dialog to executables (`.exe`, `.bat`, `.cmd`, etc. on
 * Windows; any file on POSIX). Includes a "Clear" title-bar button that
 * resets `opencode.executablePath` to empty (the default PATH-based lookup).
 */
export async function showExecutablePathQuickPick(): Promise<void> {
  const { executablePath: currentPath } = getConfiguration();

  const clearButton: QuickInputButton = {
    iconPath: new ThemeIcon('close'),
    tooltip: currentPath ? `Clear Path (${currentPath})` : 'Clear Path',
  };

  // QuickPick is used purely as a confirmation/info surface here. The actual
  // file selection happens via a native open dialog opened from the "Browse..."
  // button on the title bar. This keeps the entry-point consistent with the
  // other settings (Model/Agent) which all live inside the Settings QuickPick.
  const quickPick = window.createQuickPick<QuickPickItem>();
  quickPick.title = 'OpenCode Executable';
  quickPick.placeholder = 'Pick the absolute path to the opencode executable';
  quickPick.buttons = [clearButton];
  quickPick.items = [
    {
      label: '$(folder-opened) Browse...',
      description: 'Open a file picker to choose the opencode executable',
    },
    {
      label: 'Current value',
      description: currentPath || '(use PATH)',
    },
  ];

  const result = await new Promise<'browse' | 'clear' | undefined>((resolve) => {
    let resolved = false;
    const finish = (value: 'browse' | 'clear' | undefined): void => {
      if (resolved) return;
      resolved = true;
      quickPick.hide();
      resolve(value);
    };
    quickPick.onDidAccept(() => {
      // Selecting "Browse..." is the only accept-driven action; the second
      // item is informational.
      const selected = quickPick.selectedItems[0];
      if (selected && selected.label.startsWith('$(folder-opened)')) {
        finish('browse');
      }
    });
    quickPick.onDidTriggerButton((button) => {
      if (button === clearButton) {
        finish('clear');
      }
    });
    quickPick.onDidHide(() => {
      if (!resolved) finish(undefined);
      quickPick.dispose();
    });
    quickPick.show();
  });

  if (result === 'clear') {
    setConfiguration('executablePath', '');
    void window.showInformationMessage(
      'OpenCode executable cleared. Reload the window to use the default PATH lookup.',
    );
    return;
  }

  if (result !== 'browse') return;

  // Platform-specific file filter. The dialog still allows "All files" so a
  // user on a non-Windows platform can pick an un-extensioned binary like
  // `/home/user/bin/opencode` without renaming.
  const filters: { [name: string]: string[] } =
    process.platform === 'win32'
      ? {
          Executables: ['exe', 'bat', 'cmd', 'ps1'],
          'All files': ['*'],
        }
      : { 'All files': ['*'] };

  const picked = await window.showOpenDialog({
    title: 'Select OpenCode Executable',
    openLabel: 'Use this executable',
    canSelectMany: false,
    canSelectFiles: true,
    canSelectFolders: false,
    filters,
  });

  if (!picked || picked.length === 0) return;

  const selected = picked[0];
  // `Uri.fsPath` returns a native path (backslashes on Windows). Persist that
  // as-is — the path is only ever consumed inside the extension host where
  // Node's `fs` APIs accept either separator.
  const fsPath = selected.fsPath;
  setConfiguration('executablePath', fsPath);
  void window.showInformationMessage(
    `OpenCode executable set to ${fsPath}. Reload the window for the change to take effect.`,
  );
}

/**
 * Builds the list of QuickPick items for the Default Model picker.
 *
 * The list is grouped by provider with separators. Each model row shows:
 *   - label: `$(check) ` (current) + `$(gift) ` (free) + model name
 *   - description: provider name · context limit · "(current)" hint
 *   - detail: full `model.id` (visible on hover / second line)
 *
 * `filter` is matched case-insensitively against the model name, id, and
 * provider name. When the filter produces no matches, a single
 * read-only "No models match" row is returned.
 */
function buildModelPickItems(
  models: ModelInfo[],
  currentModel: string,
  filter: string,
): ModelPickItem[] {
  const q = filter.trim().toLowerCase();
  const matches = (m: ModelInfo): boolean => {
    if (!q) return true;
    if (m.name.toLowerCase().includes(q)) return true;
    if (m.id.toLowerCase().includes(q)) return true;
    const provider = m.providerName ?? m.providerId ?? '';
    return provider.toLowerCase().includes(q);
  };

  const filtered = models.filter(matches);
  if (filtered.length === 0) {
    return [
      {
        label: `No models match "${filter}"`,
        id: '',
      },
    ];
  }

  const byProvider = new Map<string, ModelInfo[]>();
  for (const m of filtered) {
    const key = m.providerName ?? m.providerId ?? 'Unknown';
    const list = byProvider.get(key);
    if (list) {
      list.push(m);
    } else {
      byProvider.set(key, [m]);
    }
  }

  for (const list of byProvider.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }

  const items: ModelPickItem[] = [];
  for (const [provider, providerModels] of byProvider) {
    items.push({
      label: provider,
      kind: QuickPickItemKind.Separator,
      id: '',
    });
    for (const m of providerModels) {
      // Use a case-insensitive comparison so a manually-edited settings.json
      // entry with different casing still highlights the current default.
      // The `?? ''` is defensive: `getConfiguration()` is typed to return a
      // string, but the workspace configuration getter can be null in tests
      // or unusual environments.
      const normalizedCurrent = (currentModel ?? '').toLowerCase();
      const isCurrent = m.id.toLowerCase() === normalizedCurrent;
      // A model is treated as "free" when its id ends with the delimited
      // `free` segment (e.g. `opencode/deepseek-v4-flash-free`). Requiring a
      // separator before `free` at the end avoids false positives like
      // `freedom-model-v1`.
      const isFree = /(?:^|[-_/.])free$/.test(m.id.toLowerCase());
      const ctx = m.contextLimit ? `${Math.round(m.contextLimit / 1000)}k ctx` : '';
      const description = [m.providerName, ctx, isCurrent ? 'current' : '']
        .filter(Boolean)
        .join(' · ');
      const prefix = `${isCurrent ? '$(check) ' : ''}${isFree ? '$(gift) ' : ''}`;
      items.push({
        label: `${prefix}${m.name}`,
        description: description || undefined,
        detail: m.id,
        id: m.id,
      });
    }
  }
  return items;
}

/**
 * QuickPick item shape used by the Default Model picker.
 * `id` is empty for separator/empty-state rows.
 */
interface ModelPickItem extends QuickPickItem {
  id: string;
}

/**
 * Shows a QuickPick populated with available models grouped by provider.
 * Only shows connected providers. Marks the currently configured default.
 * Uses a title bar button to clear the default when one is set.
 *
 * The QuickPick search input is wired to {@link buildModelPickItems} so
 * users can filter by model name, id, or provider name as they type.
 */
export async function showModelQuickPick(sdk: SDKClient): Promise<void> {
  let models: ModelInfo[];
  try {
    models = await sdk.getModels();
  } catch {
    void window.showErrorMessage('Failed to load available models.');
    return;
  }

  if (models.length === 0) {
    void window.showInformationMessage('No models available. Check your provider connections.');
    return;
  }

  const { model: currentModel } = getConfiguration();

  const connected = models.filter((m) => m.isConnected !== false);
  if (connected.length === 0) {
    void window.showInformationMessage(
      'No connected providers. Check your provider configuration.',
    );
    return;
  }

  const quickPick = window.createQuickPick<ModelPickItem>();
  quickPick.title = 'Default Model';
  quickPick.placeholder = 'Type to filter by name, id, or provider';
  quickPick.items = buildModelPickItems(connected, currentModel, '');

  const clearButton: QuickInputButton = {
    iconPath: new ThemeIcon('close'),
    tooltip: currentModel ? `Clear Default (${currentModel})` : 'Clear Default',
  };

  if (currentModel) {
    quickPick.buttons = [clearButton];
  }

  const result = await new Promise<ModelPickItem | 'clear' | undefined>((resolve) => {
    let resolved = false;
    quickPick.onDidChangeValue((value) => {
      if (resolved) return;
      quickPick.items = buildModelPickItems(connected, currentModel, value);
    });
    quickPick.onDidAccept(() => {
      if (resolved) return;
      const selected = quickPick.selectedItems[0];
      // Reject the empty-state row (it has no id and would clear the model).
      if (!selected || !selected.id) {
        quickPick.hide();
        return;
      }
      resolved = true;
      quickPick.hide();
      resolve(selected);
    });
    quickPick.onDidTriggerButton((button) => {
      if (resolved) return;
      if (button === clearButton) {
        resolved = true;
        quickPick.hide();
        resolve('clear');
      }
    });
    quickPick.onDidHide(() => {
      if (!resolved) {
        resolve(undefined);
      }
      quickPick.dispose();
    });
    quickPick.show();
  });

  if (result === undefined) return;

  if (result === 'clear') {
    setConfiguration('model', '');
    void window.showInformationMessage('Default model cleared.');
    return;
  }

  setConfiguration('model', result.id);
  void window.showInformationMessage(`Default model set to ${result.id}.`);
}

/**
 * Shows a QuickPick populated with available agents.
 * Filters out hidden and subagent entries.
 * Uses a title bar button to clear the default when one is set.
 */
export async function showAgentQuickPick(sdk: SDKClient): Promise<void> {
  let agents;
  try {
    agents = await sdk.getAgents();
  } catch {
    void window.showErrorMessage('Failed to load available agents.');
    return;
  }

  if (agents.length === 0) {
    void window.showInformationMessage('No agents available.');
    return;
  }

  const { agent: currentAgent } = getConfiguration();

  const visible = agents.filter((a) => a.mode !== 'subagent' && a.hidden !== true);

  interface AgentPickItem extends QuickPickItem {
    id: string;
  }

  const items: AgentPickItem[] = visible.map((a) => ({
    label: `${a.id === currentAgent ? '$(check) ' : ''}${a.name}`,
    description: a.mode ? `mode: ${a.mode}` : '',
    id: a.id,
  }));

  const quickPick = window.createQuickPick<AgentPickItem>();
  quickPick.title = 'Default Agent';
  quickPick.placeholder = 'Select a default agent for new sessions';
  quickPick.items = items;

  const clearButton: QuickInputButton = {
    iconPath: new ThemeIcon('close'),
    tooltip: currentAgent ? `Clear Default (${currentAgent})` : 'Clear Default',
  };

  if (currentAgent) {
    quickPick.buttons = [clearButton];
  }

  const result = await new Promise<AgentPickItem | 'clear' | undefined>((resolve) => {
    let resolved = false;
    quickPick.onDidAccept(() => {
      if (resolved) return;
      resolved = true;
      const selected = quickPick.selectedItems[0];
      quickPick.hide();
      resolve(selected);
    });
    quickPick.onDidTriggerButton((button) => {
      if (resolved) return;
      if (button === clearButton) {
        resolved = true;
        quickPick.hide();
        resolve('clear');
      }
    });
    quickPick.onDidHide(() => {
      if (!resolved) {
        resolve(undefined);
      }
      quickPick.dispose();
    });
    quickPick.show();
  });

  if (result === undefined) return;

  if (result === 'clear') {
    setConfiguration('agent', '');
    void window.showInformationMessage('Default agent cleared.');
    return;
  }

  setConfiguration('agent', result.id);
  void window.showInformationMessage(`Default agent set to ${result.id}.`);
}
