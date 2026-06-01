/**
 * @file File path utility functions.
 */

/** Extracts the filename from a file path. */
export function getFilename(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] ?? filePath;
}

/** Extracts the directory path (without filename) from a file path. */
export function getDirectory(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  parts.pop();
  return parts.join('/');
}
