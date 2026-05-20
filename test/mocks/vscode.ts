/**
 * @file Mock VS Code API for extension host tests.
 * Provides mock implementations of commands, window, workspace, env, and extensions.
 */

import { vi } from 'vitest';

export const mockVscode = {
  StatusBarAlignment: {
    Left: 1,
    Right: 2,
  },
  ThemeColor: class {
    constructor(public readonly id: string) {}
  },
  commands: {
    executeCommand: vi.fn(),
    registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
  },
  window: {
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showTextDocument: vi.fn(),
    showOpenDialog: vi.fn(),
    registerWebviewViewProvider: vi.fn(() => ({ dispose: vi.fn() })),
    createStatusBarItem: vi.fn(() => ({
      show: vi.fn(),
      hide: vi.fn(),
      dispose: vi.fn(),
      text: '',
      tooltip: '',
      command: '',
      backgroundColor: undefined,
    })),
    createWebviewPanel: vi.fn(() => ({
      webview: {
        postMessage: vi.fn(),
        onDidReceiveMessage: vi.fn(),
        asWebviewUri: vi.fn((uri: URL) => uri.href),
        cspSource: 'vscode-webview://test',
      },
      onDidDispose: vi.fn(),
      onDidChangeVisibility: vi.fn(),
      reveal: vi.fn(),
    })),
    createWebviewView: vi.fn(() => ({
      webview: {
        postMessage: vi.fn(),
        onDidReceiveMessage: vi.fn(),
        asWebviewUri: vi.fn((uri: URL) => uri.href),
        cspSource: 'vscode-webview://test',
      },
      onDidDispose: vi.fn(),
      onDidChangeVisibility: vi.fn(),
      visible: true,
    })),
  },
  Uri: {
    file: vi.fn((path: string) => ({ fsPath: path, path, scheme: 'file' })),
    parse: vi.fn((str: string) => ({
      fsPath: str.replace('file://', ''),
      path: str,
      scheme: 'file',
    })),
  },
  RelativePattern: class {
    constructor(
      public readonly base: unknown,
      public readonly pattern: string,
    ) {}
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn(() => null),
      update: vi.fn(),
    })),
    openTextDocument: vi.fn(),
    getWorkspaceFolder: vi.fn(() => undefined),
    workspaceFolders: [],
    findFiles: vi.fn().mockResolvedValue([]),
  },
  env: {
    clipboard: {
      writeText: vi.fn(),
      readText: vi.fn(),
    },
    machineId: 'test-machine-id',
    sessionId: 'test-session-id',
  },
  extensions: {
    getExtension: vi.fn(() => ({
      extensionPath: '/test',
      packageJSON: { name: 'test' },
    })),
  },
};

vi.mock('vscode', () => mockVscode);
