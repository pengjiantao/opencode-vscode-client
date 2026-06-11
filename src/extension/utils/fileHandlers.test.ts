/**
 * @file Unit tests for fileHandlers.ts.
 * Verifies resolveFilePath behaves correctly for file URIs, home directories,
 * absolute paths, and relative paths. Also verifies file:open and file:query IPC registration.
 */

import * as fs from 'fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { workspace } from 'vscode';
import type { IPCBridge } from '../ipc';
import type { SDKClient } from '../sdk-client';
import type { WorkspaceSearchResult } from '../types';
import { registerFileHandlers, resolveFilePath } from './fileHandlers';

vi.mock('fs', () => ({
  promises: {
    stat: vi.fn(),
  },
}));

function createMockSdkClient(overrides?: {
  findFiles?: (query: string, limit?: number) => Promise<string[]>;
}): SDKClient {
  return {
    find: {
      files: overrides?.findFiles ?? vi.fn().mockResolvedValue([]),
    },
  } as unknown as SDKClient;
}

describe('fileHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveFilePath', () => {
    it('should parse file:// URLs correctly', () => {
      const result = resolveFilePath('file:///home/user/document.txt');
      expect(result).toBe('/home/user/document.txt');
    });

    it('should expand ~ to home directory', () => {
      const originalHome = process.env.HOME;
      process.env.HOME = '/home/mock-user';
      try {
        const result = resolveFilePath('~/documents/notes.md');
        expect(result).toBe('/home/mock-user/documents/notes.md');
      } finally {
        process.env.HOME = originalHome;
      }
    });

    it('should resolve relative paths against workspace folders', () => {
      const originalFolders = workspace.workspaceFolders;

      // Type-safe cast to mutate readonly workspaceFolders on the mock
      (workspace as { workspaceFolders: unknown }).workspaceFolders = [
        {
          uri: { fsPath: '/home/workspace', path: '/home/workspace', scheme: 'file' },
          name: 'workspace',
          index: 0,
        },
      ];

      try {
        const result = resolveFilePath('src/app.ts');
        expect(result).toBe('/home/workspace/src/app.ts');
      } finally {
        (workspace as { workspaceFolders: unknown }).workspaceFolders = originalFolders;
      }
    });

    it('should return absolute paths as-is', () => {
      const result = resolveFilePath('/var/log/syslog');
      expect(result).toBe('/var/log/syslog');
    });
  });

  describe('registerFileHandlers', () => {
    it('should register file:open, file:query, and workspace:search-files listeners', () => {
      const onSpy = vi.fn();
      const mockIpc = {
        on: onSpy,
        send: vi.fn(),
      } as unknown as IPCBridge;

      registerFileHandlers(mockIpc, createMockSdkClient());

      expect(onSpy).toHaveBeenCalledWith('file:open', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('file:query', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('workspace:search-files', expect.any(Function));
    });

    it('should delegate workspace:search-files to SDK find.files and convert results', async () => {
      const originalFolders = workspace.workspaceFolders;
      (workspace as { workspaceFolders: unknown }).workspaceFolders = [
        {
          uri: { fsPath: '/home/workspace', path: '/home/workspace', scheme: 'file' },
          name: 'workspace',
          index: 0,
        },
      ];

      const findFilesMock = vi
        .fn()
        .mockResolvedValue(['package.json', 'src/app.ts', 'src/root-only.txt']);

      vi.mocked(fs.promises.stat).mockRejectedValue(new Error('ENOENT'));

      const onSpy = vi.fn();
      const sendSpy = vi.fn();
      const mockIpc = {
        on: onSpy,
        send: sendSpy,
      } as unknown as IPCBridge;

      registerFileHandlers(mockIpc, createMockSdkClient({ findFiles: findFilesMock }));

      const searchCall = onSpy.mock.calls.find((call) => call[0] === 'workspace:search-files');
      expect(searchCall).toBeDefined();
      const handler = searchCall![1] as (msg: { query: string }) => void;

      handler({ query: 'app' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(findFilesMock).toHaveBeenCalledWith('app', 50);
      expect(sendSpy).toHaveBeenCalled();
      const response = sendSpy.mock.calls[0][0] as {
        type: string;
        query: string;
        results: WorkspaceSearchResult[];
      };
      expect(response.type).toBe('workspace:search-files-response');
      expect(response.query).toBe('app');

      const results = response.results;
      expect(results).toHaveLength(3);

      expect(results[0]).toEqual({
        name: 'package.json',
        relativePath: 'package.json',
        type: 'file',
        fsPath: '/home/workspace/package.json',
      });
      expect(results[1]).toEqual({
        name: 'app.ts',
        relativePath: 'src/app.ts',
        type: 'file',
        fsPath: '/home/workspace/src/app.ts',
      });

      (workspace as { workspaceFolders: unknown }).workspaceFolders = originalFolders;
    });

    it('should detect directory type when fs.stat reports isDirectory', async () => {
      const originalFolders = workspace.workspaceFolders;
      (workspace as { workspaceFolders: unknown }).workspaceFolders = [
        {
          uri: { fsPath: '/home/workspace', path: '/home/workspace', scheme: 'file' },
          name: 'workspace',
          index: 0,
        },
      ];

      const findFilesMock = vi.fn().mockResolvedValue(['src', 'package.json']);

      vi.mocked(fs.promises.stat).mockImplementation((p) => {
        if (p === '/home/workspace/src') {
          return Promise.resolve({ isDirectory: () => true, isFile: () => false } as fs.Stats);
        }
        return Promise.resolve({ isDirectory: () => false, isFile: () => true } as fs.Stats);
      });

      const onSpy = vi.fn();
      const sendSpy = vi.fn();
      const mockIpc = {
        on: onSpy,
        send: sendSpy,
      } as unknown as IPCBridge;

      registerFileHandlers(mockIpc, createMockSdkClient({ findFiles: findFilesMock }));

      const searchCall = onSpy.mock.calls.find((call) => call[0] === 'workspace:search-files');
      const handler = searchCall![1] as (msg: { query: string }) => void;

      handler({ query: 'src' });
      await new Promise((resolve) => setTimeout(resolve, 10));

      const response = sendSpy.mock.calls[0][0] as {
        results: WorkspaceSearchResult[];
      };
      expect(response.results[0].type).toBe('dir');
      expect(response.results[0].name).toBe('src');
      expect(response.results[1].type).toBe('file');
      expect(response.results[1].name).toBe('package.json');

      (workspace as { workspaceFolders: unknown }).workspaceFolders = originalFolders;
    });

    it('should return empty results when SDK find.files fails', async () => {
      const findFilesMock = vi.fn().mockRejectedValue(new Error('SDK error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const onSpy = vi.fn();
      const sendSpy = vi.fn();
      const mockIpc = {
        on: onSpy,
        send: sendSpy,
      } as unknown as IPCBridge;

      registerFileHandlers(mockIpc, createMockSdkClient({ findFiles: findFilesMock }));

      const searchCall = onSpy.mock.calls.find((call) => call[0] === 'workspace:search-files');
      const handler = searchCall![1] as (msg: { query: string }) => void;

      handler({ query: 'test' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(sendSpy).toHaveBeenCalledWith({
        type: 'workspace:search-files-response',
        query: 'test',
        results: [],
      });

      consoleSpy.mockRestore();
    });
  });
});
