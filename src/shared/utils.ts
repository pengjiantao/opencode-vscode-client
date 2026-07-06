/**
 * @file Shared utility functions for both extension and webview sides.
 */

/**
 * Extension-based MIME lookup used by both prompt serialization and attachment handling.
 * Text/code extensions intentionally resolve to text-like MIME values so they can stay
 * as file parts, while document/archive formats resolve to non-text MIME values so
 * pasted or attached files can be converted into Markdown path references.
 */
const MIME_BY_EXTENSION: Record<string, string> = {
  bat: 'text/plain',
  bash: 'text/plain',
  c: 'text/plain',
  cc: 'text/plain',
  cjs: 'text/javascript',
  cmd: 'text/plain',
  cpp: 'text/plain',
  css: 'text/css',
  csv: 'text/csv',
  env: 'text/plain',
  fish: 'text/plain',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  go: 'text/plain',
  h: 'text/plain',
  hpp: 'text/plain',
  htm: 'text/html',
  html: 'text/html',
  ini: 'text/plain',
  java: 'text/plain',
  js: 'text/javascript',
  json: 'application/json',
  jsx: 'text/javascript',
  kt: 'text/plain',
  kts: 'text/plain',
  less: 'text/css',
  lock: 'text/plain',
  log: 'text/plain',
  md: 'text/markdown',
  markdown: 'text/markdown',
  mjs: 'text/javascript',
  php: 'text/plain',
  ps1: 'text/plain',
  py: 'text/plain',
  rb: 'text/plain',
  rs: 'text/plain',
  scala: 'text/plain',
  scss: 'text/css',
  sh: 'text/plain',
  sql: 'text/plain',
  svg: 'image/svg+xml',
  swift: 'text/plain',
  toml: 'text/plain',
  txt: 'text/plain',
  ts: 'text/plain',
  tsx: 'text/plain',
  vsix: 'application/zip',
  xml: 'application/xml',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  zsh: 'text/plain',
};

/**
 * Common text files that often have no extension but should still be treated as readable text.
 */
const TEXT_LIKE_FILENAMES = new Set([
  'dockerfile',
  'gemfile',
  'justfile',
  'license',
  'makefile',
  'procfile',
  'rakefile',
  'readme',
]);

/** Fallback MIME for APIs that need unknown filenames to behave like plain text. */
const GENERIC_TEXT_MIME = 'text/plain';

/** Fallback MIME for pasted or selected attachments when text decoding would be unsafe. */
const BINARY_MIME = 'application/octet-stream';

/**
 * Looks up a MIME type only when the filename or special basename is known.
 *
 * @param filename Filename, path, or URL-like value to inspect.
 * @returns A known MIME type, or undefined when the name should use caller-specific fallback logic.
 */
function getKnownMimeType(filename: string): string | undefined {
  const cleanName = filename.split(/[?#]/, 1)[0] ?? filename;
  const basename = cleanName.split(/[\\/]/).pop() ?? cleanName;
  if (TEXT_LIKE_FILENAMES.has(basename.toLowerCase())) return GENERIC_TEXT_MIME;

  const ext = basename.includes('.') ? basename.split('.').pop()?.toLowerCase() : undefined;
  return ext ? MIME_BY_EXTENSION[ext] : undefined;
}

/**
 * Application MIME types that are still safe to treat as text for prompt attachment chips.
 */
const TEXT_LIKE_APPLICATION_MIMES = new Set([
  'application/json',
  'application/ld+json',
  'application/xml',
  'application/xhtml+xml',
  'application/javascript',
  'application/x-javascript',
  'application/typescript',
  'application/x-typescript',
  'application/yaml',
  'application/x-yaml',
]);

/**
 * Resolves the MIME type for a given filename based on its extension.
 *
 * @param filename The name of the file (can be a full path or just the name).
 * @returns The resolved MIME type string.
 */
export function getMimeType(filename: string): string {
  return getKnownMimeType(filename) ?? GENERIC_TEXT_MIME;
}

/**
 * Resolves a MIME type for user-selected or pasted attachments.
 *
 * @param filename The filename or full path to inspect.
 * @param providedMime The optional MIME type reported by the platform.
 * @returns A MIME type that treats unknown files as binary instead of plain text.
 */
export function getAttachmentMimeType(filename: string, providedMime?: string): string {
  const inferredMime = getKnownMimeType(filename);
  if (inferredMime) return inferredMime;

  const normalizedProvided = providedMime?.split(';', 1)[0]?.trim().toLowerCase();
  if (normalizedProvided && normalizedProvided !== GENERIC_TEXT_MIME) return normalizedProvided;
  return BINARY_MIME;
}

/**
 * Determines whether a MIME type is text-decodable for prompt attachment handling.
 *
 * @param mime The MIME type to inspect.
 * @returns True for `text/*` and common text-like `application/*` formats.
 */
export function isTextLikeMime(mime: string): boolean {
  const normalized = mime.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  return (
    normalized.startsWith('text/') ||
    TEXT_LIKE_APPLICATION_MIMES.has(normalized) ||
    normalized.endsWith('+json') ||
    normalized.endsWith('+xml')
  );
}

/**
 * Determines whether a MIME type represents an image attachment.
 *
 * @param mime The MIME type to inspect.
 * @returns True when the MIME type starts with `image/`.
 */
export function isImageMime(mime: string): boolean {
  return mime.split(';', 1)[0]?.trim().toLowerCase().startsWith('image/') ?? false;
}

/**
 * Determines whether a file should be inserted as a Markdown path reference instead of a part.
 *
 * @param mime The MIME type to inspect.
 * @returns True for non-text, non-image files such as PDFs and Office documents.
 */
export function shouldUseMarkdownPathReference(mime: string): boolean {
  return !isTextLikeMime(mime) && !isImageMime(mime);
}

/**
 * Determines whether a clipboard text value looks like a local filesystem path or file URL.
 *
 * @param value The raw clipboard text.
 * @returns True when the value is a single local path-like reference.
 */
export function isLikelyFilePath(value: string): boolean {
  const text = value.trim();
  if (!text || text.includes('\n') || text.includes('\r')) return false;
  if (text.toLowerCase().startsWith('file://')) return true;
  if (/^[a-zA-Z]:[\\/]/.test(text)) return true;
  if (!/^\/(?![\\/*\s])/.test(text)) return false;

  // Avoid turning slash commands like `/goal` into file chips while still accepting `/tmp/a.pdf`.
  const hasAdditionalSeparator = text.indexOf('/', 1) !== -1;
  const hasExtension = /\.[a-zA-Z0-9]+$/.test(text);
  return hasAdditionalSeparator || hasExtension;
}

/**
 * Converts a file URL into a local filesystem path.
 *
 * @param value The `file://` URL to parse.
 * @returns A decoded local path, or undefined when the value is not a valid file URL.
 */
export function fileUrlToPath(value: string): string | undefined {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'file:') return undefined;

    const decodedPath = decodeURIComponent(url.pathname);
    if (url.hostname && url.hostname !== 'localhost') {
      return `//${url.hostname}${decodedPath}`;
    }
    if (/^\/[a-zA-Z]:\//.test(decodedPath)) {
      return decodedPath.slice(1);
    }
    return decodedPath;
  } catch {
    return undefined;
  }
}

/**
 * Extracts the final path segment from Unix or Windows style paths.
 *
 * @param filePath The path whose basename should be returned.
 * @returns The final path segment, or the original value when no separator is present.
 */
export function basenameOf(filePath: string): string {
  return filePath.replace(/\\/g, '/').split('/').pop() || filePath;
}

/**
 * Normalizes clipboard text into a local filesystem path when it is path-like.
 *
 * @param value The raw clipboard line to inspect.
 * @returns A decoded local path, or undefined when the value is not a local path reference.
 */
export function normalizeClipboardPath(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return fileUrlToPath(trimmed) ?? (isLikelyFilePath(trimmed) ? trimmed : undefined);
}

/**
 * Parses common clipboard file path text formats into unique local paths.
 *
 * @param rawValue Text from `text/uri-list`, GNOME copied-files data, or plain text.
 * @returns Unique local paths found in the clipboard payload.
 */
export function parseClipboardPathList(rawValue: string): string[] {
  const paths = rawValue
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => normalizeClipboardPath(line))
    .filter((path): path is string => path !== undefined);
  return Array.from(new Set(paths));
}

/**
 * Normalizes a local path or file URL into a `file://` URL for opencode prompt parts.
 *
 * @param value The local filesystem path or existing `file://` URL.
 * @returns A `file://` URL safe to send in a prompt file part.
 */
export function pathToFileUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed.toLowerCase().startsWith('file://')) return trimmed;

  let cleanPath = trimmed.replace(/\\/g, '/');
  if (/^[a-zA-Z]:\//.test(cleanPath)) {
    cleanPath = `/${cleanPath}`;
  } else if (!cleanPath.startsWith('/')) {
    cleanPath = `/${cleanPath}`;
  }
  return `file://${encodeURI(cleanPath)}`;
}

/**
 * Formats a Markdown link pointing at an absolute local file path.
 *
 * @param filename The visible link label.
 * @param filePath The absolute local filesystem path.
 * @returns A Markdown link using an angle-bracket destination to preserve spaces.
 */
export function formatMarkdownFileReference(filename: string, filePath: string): string {
  const label = filename.replace(/\\/g, '\\\\').replace(/\]/g, '\\]');
  const destination = filePath.replace(/\r?\n/g, ' ').replace(/>/g, '\\>');
  return `[${label}](<${destination}>)`;
}

/** Regular expression pattern to match line range suffixes at the end of filenames, e.g. " [10-20]". */
export const FILENAME_LINE_RANGE_PATTERN = /\s*\[(\d+)-(\d+)\]$/;
