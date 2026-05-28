/**
 * @file TextDocumentContentProvider for the opencode-diff URI scheme.
 * Serves before/after file content for VS Code's multi-file diff editor (vscode.changes).
 * URIs follow the format: opencode-diff:{encodedSessionId}/{encodedFilePath}?side=before|after
 */

import type { SnapshotFileDiff } from '@opencode-ai/sdk/v2/client';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter, Uri, type TextDocumentContentProvider } from 'vscode';
import type { SDKClient } from './sdk-client';

/** URI scheme used for OpenCode diff virtual documents. */
export const DIFF_SCHEME = 'opencode-diff';

/**
 * Encodes a session ID and file path into an opencode-diff URI.
 * Storing sessionID in the path (rather than authority) preserves its casing,
 * since VS Code lowercases the authority component of URIs.
 * @param sessionID The session identifier.
 * @param filePath The relative or absolute file path within the workspace.
 * @param side Whether this URI represents the 'before' or 'after' side.
 * @returns A VS Code URI with the opencode-diff scheme.
 */
export function createDiffUri(sessionID: string, filePath: string, side: 'before' | 'after'): Uri {
  const isAbsolute =
    filePath.startsWith('/') || (process.platform === 'win32' && /^[a-zA-Z]:/.test(filePath));
  const pathType = isAbsolute ? 'absolute' : 'relative';

  // Format path as: /sessionID/pathType/filePath (with filePath starting with slash)
  const normalizedFilePath = filePath.startsWith('/') ? filePath : '/' + filePath;
  const path = '/' + encodeURIComponent(sessionID) + '/' + pathType + normalizedFilePath;

  return Uri.from({
    scheme: DIFF_SCHEME,
    path,
    query: `side=${side}`,
  });
}

/**
 * Extracts the session ID, file path, and side from an opencode-diff URI.
 * @param uri The opencode-diff URI.
 * @returns Parsed components: sessionID, filePath, side.
 */
export function parseDiffUri(uri: Uri): {
  sessionID: string;
  filePath: string;
  side: 'before' | 'after';
} {
  const side = uri.query.includes('side=before') ? 'before' : 'after';

  // uri.path starts with '/'
  const pathVal = uri.path.replace(/^\//, '');

  const firstSlashIndex = pathVal.indexOf('/');
  if (firstSlashIndex === -1) {
    return { sessionID: '', filePath: '', side };
  }

  const sessionID = decodeURIComponent(pathVal.slice(0, firstSlashIndex));
  const remainingPath = pathVal.slice(firstSlashIndex + 1);

  let filePath: string;
  if (remainingPath.startsWith('absolute/')) {
    filePath = '/' + remainingPath.slice('absolute/'.length);
  } else if (remainingPath.startsWith('relative/')) {
    filePath = remainingPath.slice('relative/'.length);
  } else {
    filePath = remainingPath;
  }

  if (filePath.includes('%')) {
    filePath = decodeURIComponent(filePath);
  }

  return { sessionID, filePath, side };
}

/**
 * Represents a parsed hunk from a unified diff.
 */
interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

/**
 * Parses a unified diff string into structured hunks.
 * @param patch The unified diff text.
 * @returns Array of parsed hunks.
 */
export function parsePatch(patch: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  const lines = patch.split('\n');
  let currentHunk: DiffHunk | null = null;

  for (const line of lines) {
    const hunkMatch = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
    if (hunkMatch) {
      currentHunk = {
        oldStart: parseInt(hunkMatch[1], 10),
        oldLines: hunkMatch[2] !== undefined ? parseInt(hunkMatch[2], 10) : 1,
        newStart: parseInt(hunkMatch[3], 10),
        newLines: hunkMatch[4] !== undefined ? parseInt(hunkMatch[4], 10) : 1,
        lines: [],
      };
      hunks.push(currentHunk);
      continue;
    }

    if (
      currentHunk &&
      (line.startsWith('+') || line.startsWith('-') || line.startsWith(' ') || line === '')
    ) {
      currentHunk.lines.push(line);
    }
  }

  return hunks;
}

/**
 * Resolves a context line from the patch hunk, falling back to the hunk line's context
 * representation if the current file's lines are already exhausted.
 *
 * @param hunkLine The raw line from the patch hunk (starting with a space or empty).
 * @param currentLines The array of lines in the current file.
 * @param currentLineIndex The current index pointer in the current file.
 * @returns The resolved line content for the reconstructed file.
 */
function resolveContextLine(
  hunkLine: string,
  currentLines: string[],
  currentLineIndex: number,
): string {
  if (currentLineIndex < currentLines.length) {
    return currentLines[currentLineIndex];
  }
  // Fallback if current file context lines are exhausted
  return hunkLine.startsWith(' ') ? hunkLine.slice(1) : hunkLine;
}

/**
 * Reconstructs the "before" content by reverse-applying a patch to the current file content.
 * For each hunk: keeps context lines, keeps removed lines, skips added lines,
 * then appends the unchanged tail of the file.
 *
 * @param currentContent The current file content (the "after" side).
 * @param patch The unified diff patch text.
 * @returns The reconstructed "before" content.
 */
export function reversePatch(currentContent: string, patch: string): string {
  const hunks = parsePatch(patch);
  if (hunks.length === 0) return currentContent;

  const currentLines = currentContent.split('\n');
  const beforeLines: string[] = [];
  let currentLineIndex = 0;

  for (const hunk of hunks) {
    // The hunk's newStart is 1-based; convert to 0-based index
    const hunkStartInCurrent = hunk.newStart - 1;

    // Append lines from current file that are before this hunk (unchanged region)
    while (currentLineIndex < hunkStartInCurrent && currentLineIndex < currentLines.length) {
      beforeLines.push(currentLines[currentLineIndex]);
      currentLineIndex++;
    }

    // Process hunk lines to reconstruct the "before" state
    for (const hunkLine of hunk.lines) {
      if (hunkLine.startsWith('+')) {
        // Added line: skip it (it didn't exist in "before"), advance current pointer
        currentLineIndex++;
      } else if (hunkLine.startsWith('-')) {
        // Removed line: it existed in "before" but not in current; don't advance current pointer
        beforeLines.push(hunkLine.slice(1));
      } else if (hunkLine.startsWith(' ') || hunkLine === '') {
        // Context line: exists in both; advance current pointer
        beforeLines.push(resolveContextLine(hunkLine, currentLines, currentLineIndex));
        currentLineIndex++;
      }
    }
  }

  // Append remaining lines after the last hunk (unchanged tail)
  while (currentLineIndex < currentLines.length) {
    beforeLines.push(currentLines[currentLineIndex]);
    currentLineIndex++;
  }

  return beforeLines.join('\n');
}

/**
 * Helper to convert a file path to a normalized absolute path, resolving relative paths against a root directory.
 * Standardizes separators to forward slashes.
 * @param p The path to normalize.
 * @param root The root directory to resolve relative paths against.
 * @returns Normalized absolute path string.
 */
function toNormalizedAbsolute(p: string, root: string): string {
  const abs = path.isAbsolute(p) ? p : path.resolve(root, p);
  return path.normalize(abs).replace(/\\/g, '/');
}

/**
 * Creates a TextDocumentContentProvider for the opencode-diff scheme.
 * Fetches diff data from the backend and serves before/after file content
 * for VS Code's native diff editor.
 *
 * @param sdk The SDK client for fetching diff data.
 * @param workspaceRoot The workspace root directory for resolving file paths.
 * @returns A disposable provider and a function to clear the diff cache.
 */
export function createDiffProvider(
  sdk: SDKClient,
  workspaceRoot: string,
): { provider: TextDocumentContentProvider; clearCache: () => void } {
  const onDidChangeEmitter = new EventEmitter<Uri>();
  /** Cache of session diffs to avoid repeated API calls within a single diff view session. */
  const diffCache = new Map<string, SnapshotFileDiff[]>();

  const provider: TextDocumentContentProvider = {
    onDidChange: onDidChangeEmitter.event,

    async provideTextDocumentContent(uri: Uri): Promise<string> {
      const { sessionID, filePath, side } = parseDiffUri(uri);

      // Fetch or retrieve cached diffs for this session
      let diffs = diffCache.get(sessionID);
      if (!diffs) {
        try {
          diffs = await sdk.session.diff(sessionID);
          diffCache.set(sessionID, diffs);
        } catch (err) {
          console.error(`[DiffProvider] Failed to fetch diffs for session ${sessionID}:`, err);
          return `// Error: Failed to fetch diff data for session ${sessionID}`;
        }
      }

      // Find the matching diff for this file
      const fileDiff = diffs.find((d) => {
        if (!d.file) return false;
        return (
          toNormalizedAbsolute(d.file, workspaceRoot) ===
          toNormalizedAbsolute(filePath, workspaceRoot)
        );
      });
      if (!fileDiff) {
        return `// No diff found for file: ${filePath}`;
      }

      const patch = fileDiff.patch ?? '';
      const fullPath = path.join(workspaceRoot, filePath);

      if (side === 'after') {
        // For "after": read current file from disk; empty for deleted files
        if (fileDiff.status === 'deleted') return '';
        try {
          return fs.readFileSync(fullPath, 'utf-8');
        } catch {
          // File may not exist yet (newly added but not yet written)
          return reconstructFromPatch(patch, 'after');
        }
      } else {
        // For "before": reverse-apply patch to get original content
        if (fileDiff.status === 'added') return '';
        try {
          const currentContent = fs.readFileSync(fullPath, 'utf-8');
          return reversePatch(currentContent, patch);
        } catch {
          // File doesn't exist on disk (deleted or not yet created)
          return reconstructFromPatch(patch, 'before');
        }
      }
    },
  };

  return {
    provider,
    clearCache: () => diffCache.clear(),
  };
}

/**
 * Reconstructs file content from a patch when the file is not available on disk.
 * Used as a fallback for deleted files ("before") or newly added files ("after").
 *
 * @param patch The unified diff patch text.
 * @param side Which side to reconstruct.
 * @returns The reconstructed file content.
 */
export function reconstructFromPatch(patch: string, side: 'before' | 'after'): string {
  const hunks = parsePatch(patch);
  const lines: string[] = [];

  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (side === 'before') {
        // "before": keep context and removed lines
        if (line.startsWith('-')) {
          lines.push(line.slice(1));
        } else if (line.startsWith(' ') || line === '') {
          lines.push(line.startsWith(' ') ? line.slice(1) : line);
        }
      } else {
        // "after": keep context and added lines
        if (line.startsWith('+')) {
          lines.push(line.slice(1));
        } else if (line.startsWith(' ') || line === '') {
          lines.push(line.startsWith(' ') ? line.slice(1) : line);
        }
      }
    }
  }

  return lines.join('\n');
}
