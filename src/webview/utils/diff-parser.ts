/**
 * @file Parsers unified diff strings into a structured format for rendering.
 */

/**
 * Represents a single line of a parsed diff.
 */
export interface DiffLine {
  /** Type of the change: added, removed, or unmodified context. */
  type: 'added' | 'removed' | 'context';
  /** The content of the line (excluding the leading sign character). */
  content: string;
  /** The 1-based line number in the original file, or null if added. */
  oldLineNumber: number | null;
  /** The 1-based line number in the modified file, or null if removed. */
  newLineNumber: number | null;
}

/**
 * Represents a single hunk of changes in a diff.
 */
export interface DiffHunk {
  /** The raw hunk header (e.g. @@ -1,5 +1,7 @@). */
  header: string;
  /** The parsed lines contained within this hunk. */
  lines: DiffLine[];
}

/**
 * Represents a fully parsed single-file unified diff.
 */
export interface ParsedDiff {
  /** The original file path. */
  oldFile: string;
  /** The new/modified file path. */
  newFile: string;
  /** The structured hunks belonging to this diff. */
  hunks: DiffHunk[];
}

/**
 * Parses a unified diff string into a structured ParsedDiff representation.
 *
 * @param diffText The raw unified diff string to parse.
 * @returns The structured ParsedDiff object.
 */
export function parseDiff(diffText: string): ParsedDiff {
  // Normalize newlines and split by line
  const lines = diffText.split(/\r?\n/);
  const hunks: DiffHunk[] = [];
  let oldFile = '';
  let newFile = '';
  let currentHunk: DiffHunk | null = null;

  // Track the current lines in the files during hunk parsing
  let oldLineCursor = 0;
  let newLineCursor = 0;

  for (const line of lines) {
    // Parse file headers: '--- a/path/to/file' and '+++ b/path/to/file'
    if (line.startsWith('--- ')) {
      // Strip standard 'a/' or 'b/' prefix if present
      oldFile = line.slice(4).replace(/^(a\/|b\/)/, '');
      continue;
    }
    if (line.startsWith('+++ ')) {
      newFile = line.slice(4).replace(/^(a\/|b\/)/, '');
      continue;
    }
    // Skip git diff headers or index metadata lines as they are irrelevant for rendering
    if (
      line.startsWith('diff --git') ||
      line.startsWith('index ') ||
      line.startsWith('similarity index') ||
      line.startsWith('rename from') ||
      line.startsWith('rename to')
    ) {
      continue;
    }

    // Parse hunk header: @@ -oldStart,oldLength +newStart,newLength @@ [context]
    // The length suffix is optional (e.g., if there's only 1 line, git diff can omit ',1')
    const hunkHeaderMatch = line.match(/^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
    if (hunkHeaderMatch) {
      oldLineCursor = parseInt(hunkHeaderMatch[1], 10);
      newLineCursor = parseInt(hunkHeaderMatch[2], 10);
      currentHunk = {
        header: line,
        lines: [],
      };
      hunks.push(currentHunk);
      continue;
    }

    // If we're inside a hunk, parse the line types
    if (currentHunk) {
      if (line.startsWith('+')) {
        currentHunk.lines.push({
          type: 'added',
          content: line.slice(1),
          oldLineNumber: null,
          newLineNumber: newLineCursor++,
        });
      } else if (line.startsWith('-')) {
        currentHunk.lines.push({
          type: 'removed',
          content: line.slice(1),
          oldLineNumber: oldLineCursor++,
          newLineNumber: null,
        });
      } else if (line.startsWith(' ') || line === '') {
        currentHunk.lines.push({
          type: 'context',
          content: line.startsWith(' ') ? line.slice(1) : line,
          oldLineNumber: oldLineCursor++,
          newLineNumber: newLineCursor++,
        });
      } else if (line.startsWith('\\ No newline at end of file')) {
        // No-newline indicator is just ignored for line numbering, but we could track it if needed.
        // We skip it to keep the code lines clean.
        continue;
      } else {
        // Fallback for lines in poorly formed patches. We treat them as context lines
        // so that the reader can still see the diff context, rather than dropping content.
        currentHunk.lines.push({
          type: 'context',
          content: line,
          oldLineNumber: oldLineCursor++,
          newLineNumber: newLineCursor++,
        });
      }
    }
  }

  return {
    oldFile,
    newFile,
    hunks,
  };
}
