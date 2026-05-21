/**
 * @file Unit tests for fileHandlers.ts.
 * Verifies resolveFilePath behaves correctly for file URIs, home directories,
 * absolute paths, and relative paths. Also verifies file:open and file:query IPC registration.
 */

import * as fs from 'fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Uri, workspace } from 'vscode';
import type { IPCBridge } from '../ipc';
import type { WorkspaceSearchResult } from '../types';
import { clearWorkspaceCache, registerFileHandlers, resolveFilePath } from './fileHandlers';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  promises: {
    stat: vi.fn(),
    readFile: vi.fn(),
  },
}));

describe('fileHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearWorkspaceCache();
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
    it('should register file:open and file:query listeners', () => {
      const onSpy = vi.fn();
      const mockIpc = {
        on: onSpy,
        send: vi.fn(),
      } as unknown as IPCBridge;

      registerFileHandlers(mockIpc);

      expect(onSpy).toHaveBeenCalledWith('file:open', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('file:query', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('workspace:search-files', expect.any(Function));
    });

    it('should respect .gitignore files when querying workspace items via workspace:search-files', async () => {
      const originalFolders = workspace.workspaceFolders;
      (workspace as { workspaceFolders: unknown }).workspaceFolders = [
        {
          uri: { fsPath: '/home/workspace', path: '/home/workspace', scheme: 'file' },
          name: 'workspace',
          index: 0,
        },
      ];

      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === '/home/workspace/.gitignore') return true;
        return false;
      });

      vi.mocked(fs.promises.readFile).mockResolvedValue(
        '# comments\nnode_modules/\ndist/\n*.log\n/root-only.txt\n',
      );

      const mockFindFiles = vi.spyOn(workspace, 'findFiles').mockResolvedValue([
        {
          fsPath: '/home/workspace/package.json',
          path: '/home/workspace/package.json',
          scheme: 'file',
        } as unknown as Uri,
        {
          fsPath: '/home/workspace/node_modules/lodash/index.js',
          path: '/home/workspace/node_modules/lodash/index.js',
          scheme: 'file',
        } as unknown as Uri,
        {
          fsPath: '/home/workspace/dist/bundle.js',
          path: '/home/workspace/dist/bundle.js',
          scheme: 'file',
        } as unknown as Uri,
        {
          fsPath: '/home/workspace/debug.log',
          path: '/home/workspace/debug.log',
          scheme: 'file',
        } as unknown as Uri,
        {
          fsPath: '/home/workspace/src/app.ts',
          path: '/home/workspace/src/app.ts',
          scheme: 'file',
        } as unknown as Uri,
        {
          fsPath: '/home/workspace/src/root-only.txt',
          path: '/home/workspace/src/root-only.txt',
          scheme: 'file',
        } as unknown as Uri,
      ]);

      const onSpy = vi.fn();
      const sendSpy = vi.fn();
      const mockIpc = {
        on: onSpy,
        send: sendSpy,
      } as unknown as IPCBridge;

      registerFileHandlers(mockIpc);

      const searchCall = onSpy.mock.calls.find((call) => call[0] === 'workspace:search-files');
      expect(searchCall).toBeDefined();
      const handler = searchCall![1] as (msg: { query: string }) => void;

      handler({ query: '' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(sendSpy).toHaveBeenCalled();
      const response = sendSpy.mock.calls[0][0] as {
        type: string;
        results: WorkspaceSearchResult[];
      };
      expect(response.type).toBe('workspace:search-files-response');
      const results = response.results;

      expect(results.some((r) => r.name === 'package.json')).toBe(true);
      expect(results.some((r) => r.name === 'app.ts')).toBe(true);
      expect(results.some((r) => r.name === 'root-only.txt')).toBe(true);

      expect(results.some((r) => r.name === 'lodash')).toBe(false);
      expect(results.some((r) => r.name === 'bundle.js')).toBe(false);
      expect(results.some((r) => r.name === 'debug.log')).toBe(false);

      (workspace as { workspaceFolders: unknown }).workspaceFolders = originalFolders;
      mockFindFiles.mockRestore();
    });
  });
});
