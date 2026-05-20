/**
 * @file Shared utility functions for both extension and webview sides.
 */

/**
 * Resolves the MIME type for a given filename based on its extension.
 *
 * @param filename The name of the file (can be a full path or just the name).
 * @returns The resolved MIME type string.
 */
export function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif' || ext === 'webp') {
    return `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  }
  if (ext === 'pdf') {
    return 'application/pdf';
  }
  return 'text/plain';
}
