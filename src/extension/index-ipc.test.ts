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
  default: {
    existsSync: vi.fn(),
    statSync: vi.fn(),
    readFileSync: vi.fn(),
    promises: {
      stat: vi.fn(),
      readFile: vi.fn(),
    },
  },
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
  question: {
    reply: vi.fn().mockResolvedValue(undefined),
    reject: vi.fn().mockResolvedValue(undefined),
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

    const mockDoc = {
      lineAt: vi.fn().mockReturnValue({ text: 'mockContent' }),
    };
    const mockEditor = {
      selection: undefined as import('vscode').Selection | undefined,
      revealRange: vi.fn(),
    };
    vi.spyOn(workspace, 'getWorkspaceFolder').mockReturnValue({
      uri: { fsPath: '/some', path: '/some', scheme: 'file' } as unknown as Uri,
      name: 'workspace',
      index: 0,
    });
    const openTextDocumentSpy = vi
      .spyOn(workspace, 'openTextDocument')
      .mockResolvedValue(mockDoc as unknown as import('vscode').TextDocument);
    vi.spyOn(window, 'showTextDocument').mockResolvedValue(
      mockEditor as unknown as import('vscode').TextEditor,
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
      // 1. Without line numbers
      void openHandler({ path: '/some/file.txt' });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(openTextDocumentSpy).toHaveBeenCalled();

      // 2. With startLine only
      mockEditor.revealRange.mockClear();
      void openHandler({ path: '/some/file.txt', startLine: 10 });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(mockEditor.selection).toBeDefined();
      expect(mockEditor.selection?.anchor.line).toBe(9);
      expect(mockEditor.selection?.active.line).toBe(9);
      expect(mockEditor.selection?.anchor.character).toBe(0);
      expect(mockEditor.selection?.active.character).toBe(0);
      expect(mockEditor.revealRange).toHaveBeenCalled();

      // 3. With startLine and endLine
      mockEditor.revealRange.mockClear();
      void openHandler({ path: '/some/file.txt', startLine: 10, endLine: 15 });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(mockEditor.selection).toBeDefined();
      expect(mockEditor.selection?.anchor.line).toBe(9);
      expect(mockEditor.selection?.active.line).toBe(14);
      expect(mockEditor.selection?.active.character).toBe('mockContent'.length);
      expect(mockEditor.revealRange).toHaveBeenCalled();
    }

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
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
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
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('regression: forwards permission.asked event to webview and does not show native dialog', async () => {
    await activate(mockContext);

    const showInfoMock = vi.mocked(window.showInformationMessage);
    mockIpcSend.mockClear();
    mockSdk.permission.reply.mockClear();

    if (sseHandlerCallback) {
      sseHandlerCallback({
        type: 'permission.asked',
        properties: {
          id: 'perm-1',
          sessionID: 'session-1',
          permission: 'write_file',
          patterns: ['ls'],
          metadata: {},
          always: [],
        },
      });
    }

    // Event should be forwarded to webview
    const sendCalls = mockIpcSend.mock.calls;
    const permissionEventForwarded = sendCalls.some(
      ([msg]) =>
        msg &&
        (msg as { type: string }).type === 'event:received' &&
        (msg as { event: { type: string } }).event?.type === 'permission.asked',
    );
    expect(permissionEventForwarded).toBe(true);
    // Native dialog must NOT be shown
    expect(showInfoMock).not.toHaveBeenCalled();
    // SDK permission.reply must NOT be called directly (handled via webview IPC)
    expect(mockSdk.permission.reply).not.toHaveBeenCalled();
  });

  it('regression: handles permission:reply IPC with error feedback on failure', async () => {
    await activate(mockContext);

    mockSdk.permission.reply.mockRejectedValueOnce(new Error('Network error'));
    mockIpcSend.mockClear();

    const replyHandler = ipcHandlers.get('permission:reply');
    expect(replyHandler).toBeDefined();

    if (replyHandler) {
      void replyHandler({ permissionID: 'perm-1', allow: true });
      // Wait for the async catch handler
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    expect(mockSdk.permission.reply).toHaveBeenCalledWith('perm-1', 'once');

    const errorCalls = mockIpcSend.mock.calls.filter(
      ([msg]) => msg && (msg as { type: string }).type === 'error',
    );
    expect(errorCalls.length).toBeGreaterThan(0);
    const errorMsg = (errorCalls[0]?.[0] as { message: string })?.message;
    expect(errorMsg).toContain('Network error');
  });

  it('regression: forwards question.asked event to webview', async () => {
    await activate(mockContext);
    mockIpcSend.mockClear();

    if (sseHandlerCallback) {
      sseHandlerCallback({
        type: 'question.asked',
        properties: {
          id: 'q-1',
          sessionID: 'session-1',
          questions: [
            {
              header: 'Header',
              question: 'Text',
              options: [],
            },
          ],
        },
      });
    }

    const sendCalls = mockIpcSend.mock.calls;
    const questionEventForwarded = sendCalls.some(
      ([msg]) =>
        msg &&
        (msg as { type: string }).type === 'event:received' &&
        (msg as { event: { type: string } }).event?.type === 'question.asked',
    );
    expect(questionEventForwarded).toBe(true);
  });

  it('regression: handles question:reply IPC with error feedback on failure', async () => {
    await activate(mockContext);
    mockSdk.question.reply.mockRejectedValueOnce(new Error('SDK reply error'));
    mockIpcSend.mockClear();

    const replyHandler = ipcHandlers.get('question:reply');
    expect(replyHandler).toBeDefined();

    if (replyHandler) {
      void replyHandler({ requestID: 'q-1', answers: [['Choice']] });
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    expect(mockSdk.question.reply).toHaveBeenCalledWith('q-1', [['Choice']]);

    const errorCalls = mockIpcSend.mock.calls.filter(
      ([msg]) => msg && (msg as { type: string }).type === 'error',
    );
    expect(errorCalls.length).toBeGreaterThan(0);
    const errorMsg = (errorCalls[0]?.[0] as { message: string })?.message;
    expect(errorMsg).toContain('SDK reply error');
  });

  it('regression: handles question:reject IPC with error feedback on failure', async () => {
    await activate(mockContext);
    mockSdk.question.reject.mockRejectedValueOnce(new Error('SDK reject error'));
    mockIpcSend.mockClear();

    const rejectHandler = ipcHandlers.get('question:reject');
    expect(rejectHandler).toBeDefined();

    if (rejectHandler) {
      void rejectHandler({ requestID: 'q-1' });
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    expect(mockSdk.question.reject).toHaveBeenCalledWith('q-1');

    const errorCalls = mockIpcSend.mock.calls.filter(
      ([msg]) => msg && (msg as { type: string }).type === 'error',
    );
    expect(errorCalls.length).toBeGreaterThan(0);
    const errorMsg = (errorCalls[0]?.[0] as { message: string })?.message;
    expect(errorMsg).toContain('SDK reject error');
  });
});
