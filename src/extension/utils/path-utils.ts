/**
 * @file Path utilities for cross-platform compatibility.
 * Provides functions to normalize file paths for communication with the
 * opencode server backend.
 */

/**
 * Normalizes a directory path to the storage format used by the opencode
 * server's `directoryColumn` (forward slashes on Windows, no-op elsewhere).
 *
 * The opencode backend stores directory paths with forward slashes on Windows
 * (e.g. `C:/Users/foo/project`). However, VS Code's `Uri.fsPath` returns
 * native paths with backslashes (e.g. `C:\Users\foo\project`). When the
 * extension sends a backslash path as the `directory` query parameter, the
 * server's SQL `WHERE directory = ?` comparison fails to match the stored
 * forward-slash values, causing session history lookups to return empty
 * results on Windows.
 *
 * This function bridges that gap by converting backslashes to forward slashes
 * on Windows before any directory value is sent to the backend.
 *
 * @param input The directory path to normalize.
 * @returns The normalized path with forward slashes on Windows, or unchanged
 *   on other platforms.
 */
export function normalizeDirectory(input: string): string {
  if (process.platform !== 'win32') return input;
  return input.replaceAll('\\', '/');
}
