/**
 * @file Unit tests for fileHandlers.ts.
 * Verifies resolveFilePath behaves correctly for file URIs, home directories,
 * absolute paths, and relative paths. Also verifies file:open and file:query IPC registration.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { workspace } from 'vscode';
import type { IPCBridge } from '../ipc';
import { registerFileHandlers, resolveFilePath } from './fileHandlers';

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
    it('should register file:open and file:query listeners', () => {
      const onSpy = vi.fn();
      const mockIpc = {
        on: onSpy,
        send: vi.fn(),
      } as unknown as IPCBridge;

      registerFileHandlers(mockIpc);

      expect(onSpy).toHaveBeenCalledWith('file:open', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('file:query', expect.any(Function));
    });
  });
});
