/**
 * @file Unit tests for path-utils.ts.
 * Verifies that normalizeDirectory correctly handles cross-platform path
 * conversion, which is critical for session history lookups on Windows.
 */

import { describe, expect, it, vi } from 'vitest';
import { normalizeDirectory } from './path-utils';

describe('normalizeDirectory', () => {
  it('converts backslashes to forward slashes on Windows', () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    try {
      expect(normalizeDirectory('C:\\Users\\foo\\project')).toBe('C:/Users/foo/project');
      expect(normalizeDirectory('D:\\path\\to\\session')).toBe('D:/path/to/session');
    } finally {
      platformSpy.mockRestore();
    }
  });

  it('preserves forward slashes on Windows (no double conversion)', () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    try {
      expect(normalizeDirectory('C:/Users/foo/project')).toBe('C:/Users/foo/project');
    } finally {
      platformSpy.mockRestore();
    }
  });

  it('returns input unchanged on Linux', () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    try {
      expect(normalizeDirectory('/home/user/project')).toBe('/home/user/project');
      expect(normalizeDirectory('/usr/local/bin')).toBe('/usr/local/bin');
    } finally {
      platformSpy.mockRestore();
    }
  });

  it('returns input unchanged on macOS', () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
    try {
      expect(normalizeDirectory('/Users/dev/my-project')).toBe('/Users/dev/my-project');
    } finally {
      platformSpy.mockRestore();
    }
  });

  it('regression: Windows backslash path matches forward-slash storage format', () => {
    // Regression test for the issue where the VS Code extension could not
    // query historical sessions on Windows. The opencode server stores
    // directory paths with forward slashes on Windows, but VS Code's
    // Uri.fsPath returns backslash paths. Without normalization, the SQL
    // WHERE directory = ? comparison would fail and return no sessions.
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    try {
      const windowsInput = 'C:\\Users\\dev\\my-project';
      const storageFormat = 'C:/Users/dev/my-project';
      expect(normalizeDirectory(windowsInput)).toBe(storageFormat);
    } finally {
      platformSpy.mockRestore();
    }
  });
});
