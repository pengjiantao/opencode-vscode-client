/**
 * @file Gitignore parser and pattern matching utility.
 * Handles character-by-character pattern translation supporting wildcards, negations, and escapes.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Represents a parsed gitignore entry pattern.
 */
export interface GitignorePattern {
  regex: RegExp;
  isNegation: boolean;
  isDirectoryOnly: boolean;
}

/**
 * Helper to escape single character for RegExp usage.
 */
function escapeRegExpChar(char: string): string {
  if (/[.+^${}()|[\]\\]/.test(char)) {
    return '\\' + char;
  }
  return char;
}

/**
 * Trims trailing spaces that are not escaped by a backslash in .gitignore.
 */
function trimTrailingUnescapedSpaces(line: string): string {
  let end = line.length;
  while (end > 0 && line[end - 1] === ' ') {
    let backslashes = 0;
    let k = end - 2;
    while (k >= 0 && line[k] === '\\') {
      backslashes++;
      k--;
    }
    if (backslashes % 2 === 1) {
      // Preceded by an odd number of backslashes, so the space is escaped.
      break;
    }
    end--;
  }
  return line.slice(0, end);
}

/**
 * Converts a .gitignore pattern line to a structured GitignorePattern.
 * Supports negation (!), escaping (\), wildcards (*, ?, **), and directory constraints.
 *
 * @param line The raw gitignore line.
 * @returns The parsed GitignorePattern, or null if line is empty/comment.
 */
export function parseGitignoreLine(line: string): GitignorePattern | null {
  const cleanLine = trimTrailingUnescapedSpaces(line);
  if (cleanLine.trim() === '' || cleanLine.startsWith('#')) {
    return null;
  }

  let isNegation = false;
  let remaining = cleanLine;
  if (remaining.startsWith('!')) {
    isNegation = true;
    remaining = remaining.slice(1);
  }

  let isDirectoryOnly = false;
  if (remaining.endsWith('/') && !remaining.endsWith('\\/')) {
    isDirectoryOnly = true;
    remaining = remaining.slice(0, -1);
  }

  // Count unescaped slashes to check root anchoring
  let hasUnescapedSlash = false;
  let slashIndex = -1;
  for (let idx = 0; idx < remaining.length; idx++) {
    if (remaining[idx] === '/') {
      let backslashes = 0;
      let k = idx - 1;
      while (k >= 0 && remaining[k] === '\\') {
        backslashes++;
        k--;
      }
      if (backslashes % 2 === 0) {
        hasUnescapedSlash = true;
        slashIndex = idx;
        break;
      }
    }
  }

  let isRootAnchored = false;
  if (hasUnescapedSlash) {
    isRootAnchored = true;
    if (slashIndex === 0) {
      remaining = remaining.slice(1);
    }
  }

  // Parse remaining string character by character
  let regexStr = '';
  let i = 0;
  const len = remaining.length;
  while (i < len) {
    const char = remaining[i];
    if (char === '\\') {
      if (i + 1 < len) {
        regexStr += escapeRegExpChar(remaining[i + 1]);
        i += 2;
      } else {
        regexStr += '\\\\';
        i += 1;
      }
    } else if (char === '*') {
      if (i + 1 < len && remaining[i + 1] === '*') {
        regexStr += '.*';
        i += 2;
      } else {
        regexStr += '[^/]*';
        i += 1;
      }
    } else if (char === '?') {
      regexStr += '[^/]';
      i += 1;
    } else {
      regexStr += escapeRegExpChar(char);
      i += 1;
    }
  }

  let patternRegex = isRootAnchored ? '^' + regexStr : '(^|/)' + regexStr;
  patternRegex += '(/|$)';

  return {
    regex: new RegExp(patternRegex),
    isNegation,
    isDirectoryOnly,
  };
}

/**
 * Reads a workspace folder's .gitignore file and converts all valid patterns.
 *
 * @param workspaceRoot The root path of the workspace folder.
 * @returns A promise resolving to an array of GitignorePatterns.
 */
export async function loadGitignorePatterns(workspaceRoot: string): Promise<GitignorePattern[]> {
  const gitignorePath = path.join(workspaceRoot, '.gitignore');
  try {
    if (fs.existsSync(gitignorePath)) {
      const content = await fs.promises.readFile(gitignorePath, 'utf-8');
      const lines = content.split(/\r?\n/);
      const patterns: GitignorePattern[] = [];
      for (const line of lines) {
        const parsed = parseGitignoreLine(line);
        if (parsed) {
          patterns.push(parsed);
        }
      }
      return patterns;
    }
  } catch (err) {
    console.error('Error loading .gitignore file:', err);
  }
  return [];
}

/**
 * Helper to split a relative path into sequential ancestors and self components.
 * For example: 'foo/bar/baz' -> ['foo', 'foo/bar', 'foo/bar/baz']
 */
function getPathAncestorsAndSelf(relativePath: string): string[] {
  const parts = relativePath.split('/');
  const paths: string[] = [];
  let current = '';
  for (const part of parts) {
    if (!part) continue;
    current = current ? `${current}/${part}` : part;
    paths.push(current);
  }
  return paths;
}

/**
 * Checks if a path matches a GitignorePattern.
 */
function matchesPattern(
  relativePath: string,
  isDirectory: boolean,
  pattern: GitignorePattern,
): boolean {
  if (pattern.isDirectoryOnly && !isDirectory) {
    return false;
  }
  return pattern.regex.test(relativePath);
}

/**
 * Evaluates whether a path is ignored by gitignore patterns, respecting negation and parent directories.
 *
 * @param relativePath Relative path to check.
 * @param isDirectory Whether the target path is a directory.
 * @param patterns The parsed list of GitignorePatterns.
 * @returns True if ignored, false otherwise.
 */
export function isPathIgnored(
  relativePath: string,
  isDirectory: boolean,
  patterns: GitignorePattern[],
): boolean {
  const components = getPathAncestorsAndSelf(relativePath);

  for (let idx = 0; idx < components.length; idx++) {
    const comp = components[idx];
    const compIsDir = idx < components.length - 1 ? true : isDirectory;

    let compIgnored = false;
    for (const pattern of patterns) {
      if (matchesPattern(comp, compIsDir, pattern)) {
        compIgnored = !pattern.isNegation;
      }
    }

    if (compIgnored) {
      return true;
    }
  }

  return false;
}
