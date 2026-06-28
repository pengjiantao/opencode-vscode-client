/**
 * @file Helpers for recognizing local file references embedded in markdown text.
 * Converts supported path formats into the file-open IPC payload data used by the webview.
 */

/** Parsed local file reference details from markdown output. */
export interface MarkdownFileReference {
  /** Local, workspace-relative, absolute, or file URI path to open. */
  path: string;
  /** Optional one-based start line to reveal in the editor. */
  startLine?: number;
  /** Optional one-based end line to select in the editor. */
  endLine?: number;
}

/** Regex source used to find plain inline file references outside markdown constructs. */
export const INLINE_FILE_REFERENCE_PATTERN =
  /(^|[\s([{"'])((?:[^\s`<>{}[\]()"']+)(?::[1-9]\d*(?:-[1-9]\d*)?(?::[1-9]\d*)?|#L[1-9]\d*(?:-L?[1-9]\d*)?))(?=$|[\s)\]},.;!?'"`])/g;

const HASH_LINE_PATTERN = /^(.+)#L([1-9]\d*)(?:-L?([1-9]\d*))?$/i;
const COLON_LINE_COLUMN_PATTERN = /^(.+):([1-9]\d*)(?:-([1-9]\d*))?:[1-9]\d*$/;
const COLON_LINE_PATTERN = /^(.+):([1-9]\d*)(?:-([1-9]\d*))?$/;
const WINDOWS_DRIVE_PATTERN = /^[A-Za-z]:[\\/]/;
const URL_SCHEME_PATTERN = /^([A-Za-z][A-Za-z\d+.-]*):/;
const EXTERNAL_URL_PATTERN = /^[A-Za-z][A-Za-z\d+.-]*:\/\//;
const COMMON_EXTENSIONLESS_FILE_PATTERN =
  /(?:^|[\\/])(?:AGENTS|CHANGELOG|Dockerfile|LICENSE|Makefile|README)$/i;
const DOTTED_FILE_PATTERN = /(?:^|[\\/])[^\\/]+\.[A-Za-z0-9][A-Za-z0-9_.-]*$/;

/**
 * Parses a markdown file reference string such as `src/app.ts:10`, `src/app.ts:10-14`,
 * `src/app.ts#L10`, or a plain local markdown link target.
 *
 * @param value The raw markdown token or link target to parse.
 * @param options Controls whether references without line numbers are accepted.
 * @returns Parsed file reference data, or `null` when the value is not a local file reference.
 */
export function parseMarkdownFileReference(
  value: string,
  options: { requireLine: boolean },
): MarkdownFileReference | null {
  const trimmed = stripAngleBrackets(value.trim());
  if (!trimmed) {
    return null;
  }

  const hashMatch = HASH_LINE_PATTERN.exec(trimmed);
  if (hashMatch) {
    return createReference(hashMatch[1], hashMatch[2], hashMatch[3]);
  }

  const colonMatch = COLON_LINE_COLUMN_PATTERN.exec(trimmed) ?? COLON_LINE_PATTERN.exec(trimmed);
  if (colonMatch) {
    return createReference(colonMatch[1], colonMatch[2], colonMatch[3]);
  }

  if (!options.requireLine && isLocalReferencePath(trimmed)) {
    return { path: normalizeReferencePath(trimmed) };
  }

  return null;
}

/**
 * Determines whether a path-like markdown value points to a local file or directory.
 *
 * @param value The path candidate after line suffixes have been removed.
 * @returns True when the path is safe to route through the local file-open IPC handler.
 */
export function isLocalReferencePath(value: string): boolean {
  const path = normalizeReferencePath(value);
  if (!path || /[\r\n]/.test(path)) {
    return false;
  }

  if (EXTERNAL_URL_PATTERN.test(path) && !path.toLowerCase().startsWith('file://')) {
    return false;
  }

  const scheme = URL_SCHEME_PATTERN.exec(path);
  if (scheme && scheme[1].toLowerCase() !== 'file' && !WINDOWS_DRIVE_PATTERN.test(path)) {
    return false;
  }

  return (
    path.toLowerCase().startsWith('file://') ||
    path.startsWith('/') ||
    path.startsWith('~/') ||
    path.startsWith('./') ||
    path.startsWith('../') ||
    WINDOWS_DRIVE_PATTERN.test(path) ||
    path.includes('/') ||
    path.includes('\\') ||
    COMMON_EXTENSIONLESS_FILE_PATTERN.test(path) ||
    DOTTED_FILE_PATTERN.test(path)
  );
}

function createReference(
  rawPath: string,
  rawStartLine: string,
  rawEndLine?: string,
): MarkdownFileReference | null {
  if (!isLocalReferencePath(rawPath)) {
    return null;
  }

  const startLine = Number(rawStartLine);
  const endLine = rawEndLine ? Number(rawEndLine) : undefined;
  return {
    path: normalizeReferencePath(rawPath),
    startLine,
    ...(endLine ? { endLine } : {}),
  };
}

function normalizeReferencePath(value: string): string {
  const trimmed = stripAngleBrackets(value.trim());
  if (!trimmed.includes('%')) {
    return trimmed;
  }

  try {
    return decodeURI(trimmed);
  } catch {
    return trimmed;
  }
}

function stripAngleBrackets(value: string): string {
  return value.startsWith('<') && value.endsWith('>') ? value.slice(1, -1) : value;
}
