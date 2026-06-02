/**
 * @file Path display utilities for converting absolute file paths to
 * workspace-relative paths when the file is within the project.
 */

/**
 * Converts an absolute file path to a workspace-relative path for display.
 * If the file is within the workspace root, returns the relative path (without leading slash).
 * If the file is outside the workspace root, returns the original absolute path.
 *
 * @param filePath The absolute file path to convert.
 * @param workspaceRoot The workspace root path, or null if not available.
 * @returns A display-friendly path string.
 */
export function toDisplayPath(filePath: string, workspaceRoot: string | null): string {
  if (!workspaceRoot || !filePath) return filePath;

  // Normalize path separators to forward slashes for consistent comparison
  const normalizedPath = filePath.replace(/\\/g, '/');
  const normalizedRoot = workspaceRoot.replace(/\\/g, '/');

  // Ensure root ends with a slash for prefix matching
  const rootPrefix = normalizedRoot.endsWith('/') ? normalizedRoot : `${normalizedRoot}/`;

  // Check if the path starts with the workspace root
  if (normalizedPath.startsWith(rootPrefix)) {
    // Return relative path without leading slash
    return normalizedPath.slice(rootPrefix.length);
  }

  // Check if the path equals the workspace root (edge case)
  if (normalizedPath === normalizedRoot) {
    return '.';
  }

  // File is outside workspace, return original path
  return filePath;
}
