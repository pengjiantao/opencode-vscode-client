/**
 * @file Helper utility functions for parsing GitHub Flavored Markdown (GFM) tables.
 * Contains separator row check, alignments parser, and character-by-character row cell splitter.
 */

/**
 * Checks if a markdown line acts as a table separator/alignment row (e.g., `|:---:|---:|`).
 *
 * Separator lines are composed solely of pipes, dashes, colons, and whitespace.
 * Requiring at least one dash per column avoids false positives with normal text pipes.
 *
 * @param line - The raw string line to analyze.
 * @returns True if the line matches the GFM table separator row format.
 */
export function isSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  // A table separator must start and end with pipes in our parser
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
    return false;
  }
  const inner = trimmed.slice(1, -1);
  const parts = inner.split('|');
  // Every column between the pipes must represent a valid GFM separator (only colons and dashes)
  return parts.every((part) => {
    const p = part.trim();
    return p.length > 0 && /^[:-]+$/.test(p);
  });
}

/**
 * Helper to check if a character at index `idx` in a string is escaped by a backslash.
 * An odd number of preceding backslashes means the character is escaped.
 *
 * @param str - The string to check.
 * @param idx - The index of the character to check.
 * @returns True if the character is escaped.
 */
export function isCharEscaped(str: string, idx: number): boolean {
  let backslashCount = 0;
  for (let j = idx - 1; j >= 0; j--) {
    if (str[j] === '\\') {
      backslashCount++;
    } else {
      break;
    }
  }
  return backslashCount % 2 === 1;
}

/**
 * Helper to measure the length of a consecutive sequence of backtick characters.
 *
 * @param str - The string to scan.
 * @param startIdx - The starting index of the backtick sequence.
 * @returns The length of consecutive backticks.
 */
export function getBacktickSeqLen(str: string, startIdx: number): number {
  let count = 0;
  for (let idx = startIdx; idx < str.length; idx++) {
    if (str[idx] === '`') {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Parses a table row, splitting cells by `|` while correctly ignoring escaped pipes `\|`.
 *
 * We iterate through the string character by character to safely handle escaped pipe
 * characters and inline backtick code spans of arbitrary lengths, ensuring they remain
 * inside cell contents rather than acting as cell borders.
 *
 * @param line - The markdown table row line to parse.
 * @returns An array of parsed cell contents, or null if the line does not start/end with pipes.
 */
export function parseTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
    return null;
  }

  // Conditionally strip trailing pipe only if it is an unescaped closing border.
  // An escaped trailing pipe (e.g. `foo \|`) belongs to the final cell's content.
  const hasClosingBorder = !isCharEscaped(trimmed, trimmed.length - 1);
  const inner = hasClosingBorder ? trimmed.slice(1, -1) : trimmed.slice(1);

  const cells: string[] = [];
  let currentCell = '';
  let activeBacktickLen = 0;
  let idx = 0;

  // Character-by-character scan to handle escaped pipes and inline code spans safely
  while (idx < inner.length) {
    const char = inner[idx];

    // Toggle backtick state for unescaped backticks to ignore internal table pipes
    if (char === '`' && !isCharEscaped(inner, idx)) {
      const len = getBacktickSeqLen(inner, idx);
      if (activeBacktickLen === 0) {
        activeBacktickLen = len;
      } else if (activeBacktickLen === len) {
        activeBacktickLen = 0;
      }
      currentCell += inner.substring(idx, idx + len);
      idx += len;
      continue;
    }

    // Split the column if we find an unescaped pipe character outside of backticks
    if (char === '|' && activeBacktickLen === 0 && !isCharEscaped(inner, idx)) {
      cells.push(currentCell.trim());
      currentCell = '';
      idx++;
      continue;
    }

    currentCell += char;
    idx++;
  }
  cells.push(currentCell.trim());

  // Replace escaped pipes back to standard pipe characters for rendering
  return cells.map((cell) => cell.replace(/\\\|/g, '|'));
}

/**
 * Extracts alignments for each column from the table separator row.
 *
 * Maps `:---:` to 'center', `:---` to 'left', `---:` to 'right', and default to null.
 *
 * @param line - The separator row line.
 * @returns An array of column alignments corresponding to each table column.
 */
export function parseAlignments(line: string): ('left' | 'center' | 'right' | null)[] {
  const cells = parseTableRow(line);
  if (!cells) {
    return [];
  }
  return cells.map((cell) => {
    const trimmed = cell.trim();
    const starts = trimmed.startsWith(':');
    const ends = trimmed.endsWith(':');
    if (starts && ends) {
      return 'center';
    }
    if (starts) {
      return 'left';
    }
    if (ends) {
      return 'right';
    }
    return null;
  });
}
