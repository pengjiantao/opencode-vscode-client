/**
 * @file Unit tests for extension IPC event handlers and permission prompt interactions.
 * Tests handling of file:open, file:query, and file:select IPC messages, image selection limits,
 * image reading failure modes, and SSE-driven permission.asked prompts.
 */

import * as fs from 'fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtensionContext } from 'vscode';
import { Uri, window, workspace } from 'vscode';
import { activate } from './index';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
  readFileSync: vi.fn(),
  promises: {
    stat: vi.fn(),
    readFile: vi.fn(),
  },
}));

// Define typed mocks for SDKClient events subscription
let sseHandlerCallback: ((event: unknown) => void) | undefined;
const mockUnsubscribeEvents = vi.fn();

const mockSdk = {
  startServer: vi.fn().mockResolvedValue({ url: 'http://localhost:3000', close: vi.fn() }),
  session: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({
      id: 'session-1',
      title: 'Untitled',
      time: { created: Date.now(), updated: Date.now() },
    }),
    messages: vi.fn().mockResolvedValue([]),
    messagesWithParts: vi.fn().mockResolvedValue([]),
  },
  subscribeEvents: vi.fn((handler: (event: unknown) => void) => {
    sseHandlerCallback = handler;
    return mockUnsubscribeEvents;
  }),
  permission: {
    reply: vi.fn().mockResolvedValue(undefined),
  },
  getModels: vi.fn().mockResolvedValue([]),
  getAgents: vi.fn().mockResolvedValue([]),
};

vi.mock('./sdk-client-impl', () => ({
  createSDKClient: vi.fn(() => mockSdk),
}));

// Map to track active IPC event handler registration for test injection
const ipcHandlers = new Map<string, (msg?: unknown) => void | Promise<void>>();
const mockIpcSend = vi.fn();

vi.mock('./ipc', () => {
  return {
    IPCBridge: vi.fn().mockImplementation(() => ({
      on: vi.fn((event: string, handler: (msg?: unknown) => void) => {
        ipcHandlers.set(event, handler);
      }),
      send: (...args: unknown[]) => {
        mockIpcSend(...args);
      },
    })),
  };
});

vi.mock('./webview-provider', () => {
  return {
    OpencodeSidebarViewProvider: vi.fn().mockImplementation(() => ({
      view: undefined,
    })),
  };
});

describe('Extension IPC & Permission Event Handlers', () => {
  let mockContext: ExtensionContext;

  beforeEach(() => {
    vi.clearAllMocks();
    ipcHandlers.clear();
    sseHandlerCallback = undefined;

    // Mock Context workspace state and subscription containers
    mockContext = {
      subscriptions: [],
      workspaceState: {
        get: vi.fn().mockReturnValue([]),
        update: vi.fn().mockResolvedValue(undefined),
      },
      globalState: {
        get: vi.fn().mockReturnValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
      } as never,
      extensionPath: '/test',
      asAbsolutePath: vi.fn(),
      storagePath: '/test-storage',
      globalStoragePath: '/test-global-storage',
      logPath: '/test-log',
    } as unknown as ExtensionContext;
  });

  it('regression: handles file:open and file:query IPC events correctly', async () => {
    await activate(mockContext);

    // Test file:open handler
    const openHandler = ipcHandlers.get('file:open');
    expect(openHandler).toBeDefined();

    const mockDoc = {};
    vi.spyOn(workspace, 'getWorkspaceFolder').mockReturnValue({
      uri: { fsPath: '/some', path: '/some', scheme: 'file' } as unknown as Uri,
      name: 'workspace',
      index: 0,
    });
    const openTextDocumentSpy = vi
      .spyOn(workspace, 'openTextDocument')
      .mockResolvedValue(mockDoc as unknown as import('vscode').TextDocument);
    vi.spyOn(window, 'showTextDocument').mockResolvedValue(
      undefined as unknown as import('vscode').TextEditor,
    );
    vi.mocked(fs.statSync).mockReturnValue({
      isFile: () => true,
      isDirectory: () => false,
      size: 1024,
    } as unknown as fs.Stats);
    vi.mocked(fs.promises.stat).mockResolvedValue({
      isFile: () => true,
      isDirectory: () => false,
      size: 1024,
    } as unknown as fs.Stats);

    if (openHandler) {
      void openHandler({ path: '/some/file.txt' });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    expect(openTextDocumentSpy).toHaveBeenCalled();

    // Test file:query handler
    const queryHandler = ipcHandlers.get('file:query');
    expect(queryHandler).toBeDefined();

    vi.mocked(fs.promises.stat).mockResolvedValue({
      isFile: () => true,
      isDirectory: () => false,
      size: 1024,
    } as unknown as fs.Stats);
    vi.mocked(fs.promises.readFile).mockResolvedValue(Buffer.from('File content'));

    if (queryHandler) {
      void queryHandler({ path: '/some/file.txt' });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    expect(fs.promises.stat).toHaveBeenCalledWith('/some/file.txt');
    expect(mockIpcSend).toHaveBeenCalledWith({
      type: 'file:query-response',
      path: '/some/file.txt',
      exists: true,
      filename: 'file.txt',
      size: 1024,
      content: 'File content',
      isWorkspace: true,
    });
  });

  it('regression: handles file:select IPC event correctly', async () => {
    await activate(mockContext);

    const selectHandler = ipcHandlers.get('file:select');
    expect(selectHandler).toBeDefined();

    const mockUris = [Uri.file('/some/test.txt'), Uri.file('/some/image.png')];
    vi.spyOn(window, 'showOpenDialog').mockResolvedValue(mockUris);

    vi.mocked(fs.promises.stat).mockImplementation((filePath) => {
      if (filePath.toString().endsWith('test.txt')) {
        return Promise.resolve({
          isFile: () => true,
          isDirectory: () => false,
          size: 100,
        } as unknown as fs.Stats);
      }
      return Promise.resolve({
        isFile: () => true,
        isDirectory: () => false,
        size: 200,
      } as unknown as fs.Stats);
    });

    vi.mocked(fs.promises.readFile).mockResolvedValue(Buffer.from('FakeImageData'));

    if (selectHandler) {
      await selectHandler();
    }

    expect(window.showOpenDialog).toHaveBeenCalledWith({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: true,
      openLabel: 'Select Files/Images',
      title: 'Select Files/Images to Reference',
    });

    expect(mockIpcSend).toHaveBeenCalledWith({
      type: 'file:selected',
      files: [
        {
          name: 'test.txt',
          fsPath: '/some/test.txt',
          size: 100,
          mime: 'text/plain',
          dataUrl: undefined,
        },
        {
          name: 'image.png',
          fsPath: '/some/image.png',
          size: 200,
          mime: 'image/png',
          dataUrl: 'data:image/png;base64,RmFrZUltYWdlRGF0YQ==',
        },
      ],
    });
  });

  it('regression: handles file:select IPC event when user cancels dialog', async () => {
    await activate(mockContext);

    const selectHandler = ipcHandlers.get('file:select');
    expect(selectHandler).toBeDefined();

    vi.spyOn(window, 'showOpenDialog').mockResolvedValue(undefined);
    mockIpcSend.mockClear();

    if (selectHandler) {
      await selectHandler();
    }

    expect(mockIpcSend).not.toHaveBeenCalled();
  });

  it('regression: skips images exceeding the 10MB size limit', async () => {
    await activate(mockContext);

    const selectHandler = ipcHandlers.get('file:select');
    expect(selectHandler).toBeDefined();

    const mockUris = [Uri.file('/some/large-image.png')];
    vi.spyOn(window, 'showOpenDialog').mockResolvedValue(mockUris);
    vi.spyOn(window, 'showErrorMessage').mockResolvedValue(undefined);

    vi.mocked(fs.promises.stat).mockResolvedValue({
      isFile: () => true,
      isDirectory: () => false,
      size: 15 * 1024 * 1024, // 15MB
    } as unknown as fs.Stats);

    mockIpcSend.mockClear();

    if (selectHandler) {
      await selectHandler();
    }

    expect(window.showErrorMessage).toHaveBeenCalledWith(
      'Image "large-image.png" exceeds the 10MB size limit.',
    );
    expect(mockIpcSend).toHaveBeenCalledWith({
      type: 'file:selected',
      files: [],
    });
  });

  it('regression: handles image read failure gracefully', async () => {
    await activate(mockContext);

    const selectHandler = ipcHandlers.get('file:select');
    expect(selectHandler).toBeDefined();

    const mockUris = [Uri.file('/some/bad-image.png')];
    vi.spyOn(window, 'showOpenDialog').mockResolvedValue(mockUris);

    vi.mocked(fs.promises.stat).mockResolvedValue({
      isFile: () => true,
      isDirectory: () => false,
      size: 200,
    } as unknown as fs.Stats);

    vi.mocked(fs.promises.readFile).mockRejectedValue(new Error('Read error'));
    mockIpcSend.mockClear();

    if (selectHandler) {
      await selectHandler();
    }

    expect(mockIpcSend).toHaveBeenCalledWith({
      type: 'file:selected',
      files: [
        {
          name: 'bad-image.png',
          fsPath: '/some/bad-image.png',
          size: 200,
          mime: 'image/png',
          dataUrl: undefined,
        },
      ],
    });
  });

  it('regression: handles permission.asked event when user selects Allow', async () => {
    await activate(mockContext);

    const showInfoMock = vi.mocked(window.showInformationMessage) as unknown as {
      mockResolvedValue: (value: string | undefined) => unknown;
      mockClear: () => void;
    };
    showInfoMock.mockResolvedValue('Allow');
    mockSdk.permission.reply.mockClear();

    if (sseHandlerCallback) {
      sseHandlerCallback({
        type: 'permission.asked',
        properties: {
          permission: {
            id: 'perm-1',
            permission: 'write_file',
          },
        },
      });
    }

    expect(showInfoMock).toHaveBeenCalledWith(
      'OpenCode Permission: write_file',
      { modal: false },
      'Allow',
      'Deny',
    );
    // Wait for the Promise handler (.then()) to execute in the event loop
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockSdk.permission.reply).toHaveBeenCalledWith('perm-1', true);
  });

  it('regression: handles permission.asked event when user selects Deny', async () => {
    await activate(mockContext);

    const showInfoMock = vi.mocked(window.showInformationMessage) as unknown as {
      mockResolvedValue: (value: string | undefined) => unknown;
      mockClear: () => void;
    };
    showInfoMock.mockResolvedValue('Deny');
    mockSdk.permission.reply.mockClear();

    if (sseHandlerCallback) {
      sseHandlerCallback({
        type: 'permission.asked',
        properties: {
          permission: {
            id: 'perm-2',
            permission: 'read_file',
          },
        },
      });
    }

    expect(showInfoMock).toHaveBeenCalledWith(
      'OpenCode Permission: read_file',
      { modal: false },
      'Allow',
      'Deny',
    );
    // Wait for the Promise handler (.then()) to execute in the event loop
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockSdk.permission.reply).toHaveBeenCalledWith('perm-2', false);
  });

  it('regression: handles permission.asked event when user dismisses the dialog', async () => {
    await activate(mockContext);

    const showInfoMock = vi.mocked(window.showInformationMessage) as unknown as {
      mockResolvedValue: (value: string | undefined) => unknown;
      mockClear: () => void;
    };
    showInfoMock.mockResolvedValue(undefined);
    mockSdk.permission.reply.mockClear();

    if (sseHandlerCallback) {
      sseHandlerCallback({
        type: 'permission.asked',
        properties: {
          permission: {
            id: 'perm-3',
            permission: 'execute_url',
          },
        },
      });
    }

    expect(showInfoMock).toHaveBeenCalledWith(
      'OpenCode Permission: execute_url',
      { modal: false },
      'Allow',
      'Deny',
    );
    // Wait for the Promise handler (.then()) to execute in the event loop
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockSdk.permission.reply).not.toHaveBeenCalled();
  });
});
