/**
 * @file Mock VS Code API for extension host tests.
 * Provides mock implementations of commands, window, workspace, env, and extensions.
 */

import { vi } from 'vitest';

export const mockVscode = {
  Position: class Position {
    constructor(
      public readonly line: number,
      public readonly character: number,
    ) {}
  },
  Range: class Range {
    constructor(
      public readonly start: unknown,
      public readonly end: unknown,
    ) {}
  },
  Selection: class Selection {
    constructor(
      public readonly anchor: unknown,
      public readonly active: unknown,
    ) {}
  },
  StatusBarAlignment: {
    Left: 1,
    Right: 2,
  },
  ThemeColor: class {
    constructor(public readonly id: string) {}
  },
  ThemeIcon: class ThemeIcon {
    constructor(
      public readonly id: string,
      public readonly color?: unknown,
    ) {}
  },
  QuickPickItemKind: {
    Separator: 1,
    Default: 0,
  },
  EventEmitter: class EventEmitter {
    _listeners: Array<(e: unknown) => unknown> = [];
    event = (listener: (e: unknown) => unknown) => {
      this._listeners.push(listener);
      return { dispose: vi.fn() };
    };
    fire = (data: unknown) => {
      for (const l of this._listeners) l(data);
    };
    dispose = vi.fn();
  },
  commands: {
    executeCommand: vi.fn(),
    registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
  },
  window: {
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showQuickPick: vi.fn(),
    showTextDocument: vi.fn(),
    showOpenDialog: vi.fn(),
    registerWebviewViewProvider: vi.fn(() => ({ dispose: vi.fn() })),
    createQuickPick: vi.fn(() => ({
      title: '',
      placeholder: '',
      items: [],
      buttons: [],
      show: vi.fn(),
      hide: vi.fn(),
      dispose: vi.fn(),
      selectedItems: [],
      onDidAccept: vi.fn(() => ({ dispose: vi.fn() })),
      onDidTriggerButton: vi.fn(() => ({ dispose: vi.fn() })),
      onDidTriggerItemButton: vi.fn(() => ({ dispose: vi.fn() })),
      onDidHide: vi.fn(() => ({ dispose: vi.fn() })),
    })),
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
    file: vi.fn((path: string) => ({
      scheme: 'file',
      authority: '',
      path,
      query: '',
      fragment: '',
      fsPath: path,
      toString: () => `file://${path}`,
    })),
    parse: vi.fn((str: string) => {
      try {
        const url = new URL(str);
        return {
          scheme: url.protocol.replace(':', ''),
          authority: url.host,
          path: url.pathname,
          query: url.search.replace(/^\?/, ''),
          fragment: url.hash.replace(/^#/, ''),
          fsPath: url.pathname,
          toString: () => str,
        };
      } catch {
        return {
          scheme: 'file',
          authority: '',
          path: str,
          query: '',
          fragment: '',
          fsPath: str,
          toString: () => str,
        };
      }
    }),
    from: vi.fn(
      (components: {
        scheme: string;
        authority?: string;
        path?: string;
        query?: string;
        fragment?: string;
      }) => {
        const rawPath = components.path || '';
        // Real VS Code Uri decodes path components
        const path = rawPath.includes('%') ? decodeURIComponent(rawPath) : rawPath;
        return {
          scheme: components.scheme,
          authority: components.authority || '',
          path,
          query: components.query || '',
          fragment: components.fragment || '',
          fsPath: path,
          toString: () => {
            const auth = components.authority ? `//${components.authority}` : '';
            const q = components.query ? `?${components.query}` : '';
            const f = components.fragment ? `#${components.fragment}` : '';
            return `${components.scheme}:${auth}${rawPath}${q}${f}`;
          },
        };
      },
    ),
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
    registerTextDocumentContentProvider: vi.fn(() => ({ dispose: vi.fn() })),
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
