/* eslint-disable @typescript-eslint/unbound-method */
/**
 * @file Unit tests for the TextDocumentContentProvider for opencode-diff URI scheme.
 * Verifies URI encoding/decoding, file path matching, and document content serving.
 */

import { describe, expect, it, vi } from 'vitest';
import { Uri, type CancellationToken } from 'vscode';
import {
  createDiffProvider,
  createDiffUri,
  parseDiffUri,
  parsePatch,
  reconstructFromPatch,
  reversePatch,
} from './diff-provider';
import type { SDKClient } from './sdk-client';

const mockToken: CancellationToken = {
  isCancellationRequested: false,
  onCancellationRequested: () => ({ dispose: () => {} }),
};

describe('Diff Provider URIs', () => {
  it('correctly encodes and decodes relative paths without leading slash mismatches', () => {
    const sessionID = 'session-test-123';
    const filePath = 'src/extension/index.ts';

    const uri = createDiffUri(sessionID, filePath, 'before');
    expect(uri.scheme).toBe('opencode-diff');

    const parsed = parseDiffUri(uri);
    expect(parsed.sessionID).toBe(sessionID);
    expect(parsed.filePath).toBe(filePath);
    expect(parsed.side).toBe('before');
  });

  it('handles file paths with spaces and special characters', () => {
    const sessionID = 'session-with-spaces';
    const filePath = 'dir with spaces/file #1.ts';

    const uri = createDiffUri(sessionID, filePath, 'after');
    const parsed = parseDiffUri(uri);

    expect(parsed.sessionID).toBe(sessionID);
    expect(parsed.filePath).toBe(filePath);
    expect(parsed.side).toBe('after');
  });

  it('correctly handles absolute paths', () => {
    const sessionID = 'session-absolute';
    const filePath = '/home/user/project/file.ts';

    const uri = createDiffUri(sessionID, filePath, 'before');
    const parsed = parseDiffUri(uri);

    expect(parsed.sessionID).toBe(sessionID);
    expect(parsed.filePath).toBe(filePath);
    expect(parsed.side).toBe('before');
  });

  it('preserves case sensitivity of session ID', () => {
    const sessionID = 'Session-ABC-123_MixedCase!';
    const filePath = 'src/main.ts';

    const uri = createDiffUri(sessionID, filePath, 'before');
    const parsed = parseDiffUri(uri);
    expect(parsed.sessionID).toBe(sessionID);
    expect(parsed.filePath).toBe(filePath);
  });

  it('handles fallback cases for malformed URIs in parseDiffUri', () => {
    // No slash in path value (after stripping leading slash)
    const malformedUri1 = Uri.from({
      scheme: 'opencode-diff',
      path: 'no-other-slashes',
      query: 'side=before',
    });
    const parsed1 = parseDiffUri(malformedUri1);
    expect(parsed1.sessionID).toBe('');
    expect(parsed1.filePath).toBe('');

    // Unknown remaining path prefix (not absolute/ or relative/)
    const malformedUri2 = Uri.from({
      scheme: 'opencode-diff',
      path: '/sessionID/otherprefix/somefile.ts',
      query: 'side=after',
    });
    const parsed2 = parseDiffUri(malformedUri2);
    expect(parsed2.sessionID).toBe('sessionID');
    expect(parsed2.filePath).toBe('otherprefix/somefile.ts');
  });
});

describe('Diff Provider Content Serving', () => {
  it('correctly retrieves and matches diff files from the session', async () => {
    const mockDiffs = [
      {
        file: 'src/main.ts',
        additions: 1,
        deletions: 1,
        status: 'modified' as const,
        patch: '@@ -1,3 +1,3 @@\n-old\n+new\n',
      },
    ];

    const mockSdk = {
      session: {
        diff: vi.fn().mockResolvedValue(mockDiffs),
      },
    } as unknown as SDKClient;

    const { provider } = createDiffProvider(mockSdk, '/workspace');
    const uri = createDiffUri('session-1', 'src/main.ts', 'before');

    // Serve virtual content
    const content = await provider.provideTextDocumentContent(uri, mockToken);
    expect(vi.mocked(mockSdk.session.diff)).toHaveBeenCalledWith('session-1');
    expect(content).not.toBe('// No diff found for file: src/main.ts');
  });

  it('returns appropriate fallback error message when file diff is not found', async () => {
    const mockDiffs = [
      {
        file: 'src/main.ts',
        additions: 1,
        deletions: 1,
        status: 'modified' as const,
        patch: '@@ -1,3 +1,3 @@\n-old\n+new\n',
      },
    ];

    const mockSdk = {
      session: {
        diff: vi.fn().mockResolvedValue(mockDiffs),
      },
    } as unknown as SDKClient;

    const { provider } = createDiffProvider(mockSdk, '/workspace');
    const uri = createDiffUri('session-1', 'src/missing-file.ts', 'before');

    const content = await provider.provideTextDocumentContent(uri, mockToken);
    expect(content).toBe('// No diff found for file: src/missing-file.ts');
  });

  it('correctly matches file regardless of relative or absolute path representation', async () => {
    const mockDiffs = [
      {
        file: '/workspace/src/main.ts', // Absolute path in diff
        additions: 1,
        deletions: 1,
        status: 'modified' as const,
        patch: '@@ -1,3 +1,3 @@\n-old\n+new\n',
      },
    ];

    const mockSdk = {
      session: {
        diff: vi.fn().mockResolvedValue(mockDiffs),
      },
    } as unknown as SDKClient;

    const { provider } = createDiffProvider(mockSdk, '/workspace');

    // Relative path in URI
    const uri = createDiffUri('session-1', 'src/main.ts', 'before');

    const content = await provider.provideTextDocumentContent(uri, mockToken);
    expect(content).not.toBe('// No diff found for file: src/main.ts');
  });
});

describe('Patch Rebuilding Algorithms', () => {
  describe('parsePatch', () => {
    it('correctly parses multiple hunks in unified diff format', () => {
      const patch = [
        '@@ -1,3 +1,4 @@',
        ' line1',
        '+added line',
        ' line2',
        ' line3',
        '@@ -10,2 +11,3 @@',
        '-deleted line',
        ' line11',
        '+inserted line',
      ].join('\n');

      const hunks = parsePatch(patch);
      expect(hunks).toHaveLength(2);
      expect(hunks[0]).toEqual({
        oldStart: 1,
        oldLines: 3,
        newStart: 1,
        newLines: 4,
        lines: [' line1', '+added line', ' line2', ' line3'],
      });
      expect(hunks[1]).toEqual({
        oldStart: 10,
        oldLines: 2,
        newStart: 11,
        newLines: 3,
        lines: ['-deleted line', ' line11', '+inserted line'],
      });
    });

    it('returns empty array if no hunk markers found', () => {
      const patch = 'some random text without @@ markers';
      const hunks = parsePatch(patch);
      expect(hunks).toHaveLength(0);
    });
  });

  describe('reversePatch', () => {
    it('returns unmodified content if patch is empty', () => {
      const currentContent = 'A\nB\nC';
      const result = reversePatch(currentContent, '');
      expect(result).toBe(currentContent);
    });

    it('correctly reverts only additions', () => {
      const newContent = 'A\nadded\nB\nC';
      const patch = '@@ -1,3 +1,4 @@\n A\n+added\n B\n C';
      const result = reversePatch(newContent, patch);
      expect(result).toBe('A\nB\nC');
    });

    it('correctly reverts only deletions', () => {
      const newContent = 'A\nC';
      const patch = '@@ -1,3 +1,2 @@\n A\n-deleted\n C';
      const result = reversePatch(newContent, patch);
      expect(result).toBe('A\ndeleted\nC');
    });

    it('reverts mixed additions and deletions across multiple hunks', () => {
      const patch = [
        '@@ -1,3 +1,3 @@',
        ' A',
        '-deleted',
        '+added',
        ' C',
        '@@ -4,1 +4,2 @@',
        ' D',
        '+inserted',
      ].join('\n');
      // Original content:
      // hunk 1: @@ -1,3 +1,3 @@ (old: A, deleted, C; new: A, added, C)
      // hunk 2: @@ -4,1 +4,2 @@ (old: D; new: D, inserted)
      // Wait, newContent is 'A\nadded\nC\nD\nE'.
      // But wait! hunk 2 has ' D', '+inserted'. This matches 'D', then currentLineIndex advances, inserting nothing since newContent has 'E' after 'D' (so 'inserted' is skipped).
      // Let's verify:
      // newContent with hunk 2 'inserted': 'A\nadded\nC\nD\ninserted\nE'
      const result = reversePatch('A\nadded\nC\nD\ninserted\nE', patch);
      expect(result).toBe('A\ndeleted\nC\nD\nE');
    });

    it('handles fallback context line resolution when current file lines are exhausted', () => {
      // Setup current file content with fewer lines than hunk context expectations
      const currentContent = 'A\nC\nD';
      // Hunk asserts there's an extra context line 'E' at the end, but the file doesn't have it
      const patch = '@@ -1,5 +1,4 @@\n A\n-B\n C\n D\n E';
      const result = reversePatch(currentContent, patch);
      // B is restored. 'E' is reconstructed from the patch context line.
      expect(result).toBe('A\nB\nC\nD\nE');
    });
  });

  describe('reconstructFromPatch', () => {
    const patch = [
      '@@ -1,3 +1,3 @@',
      ' context1',
      '-deleted line',
      '+added line',
      ' context2',
    ].join('\n');

    it('reconstructs before side (keeps context and deleted lines)', () => {
      const before = reconstructFromPatch(patch, 'before');
      expect(before).toBe('context1\ndeleted line\ncontext2');
    });

    it('reconstructs after side (keeps context and added lines)', () => {
      const after = reconstructFromPatch(patch, 'after');
      expect(after).toBe('context1\nadded line\ncontext2');
    });
  });
});
