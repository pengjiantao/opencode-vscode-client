import { vi } from 'vitest';

export const mockVscode = {
  commands: {
    executeCommand: vi.fn(),
    registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
  },
  window: {
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showWarningMessage: vi.fn(),
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
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn(() => null),
      update: vi.fn(),
    })),
    workspaceFolders: [],
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
