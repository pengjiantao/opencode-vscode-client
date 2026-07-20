/**
 * @file Normalizes GFM table rows before parsing so valid inline code spans retain literal pipes.
 * The adapter only adjusts table rows and deliberately leaves malformed code delimiters untouched.
 */

/** Marker describing an active fenced code block while scanning Markdown source. */
interface FenceMarker {
  /** Fence character used by the block. */
  character: '`' | '~';
  /** Minimum number of marker characters required to close the block. */
  length: number;
}

/** Checks whether a character is protected by an odd number of preceding backslashes. */
function isEscaped(text: string, index: number): boolean {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor--) {
    slashCount++;
  }
  return slashCount % 2 === 1;
}

/** Returns the number of consecutive backticks beginning at the supplied index. */
function getBacktickLength(text: string, startIndex: number): number {
  let length = 0;
  while (text[startIndex + length] === '`') {
    length++;
  }
  return length;
}

/** Finds a matching inline-code delimiter with the exact same marker length. */
function findClosingBackticks(text: string, startIndex: number, length: number): number {
  for (let index = startIndex + length; index < text.length; index++) {
    if (text[index] !== '`' || isEscaped(text, index)) {
      continue;
    }

    const candidateLength = getBacktickLength(text, index);
    if (candidateLength === length) {
      return index;
    }
    index += candidateLength - 1;
  }
  return -1;
}

/** Escapes table-cell delimiters while preserving already escaped literal pipes. */
function escapeCodeSpanPipes(text: string): string {
  let escaped = '';
  for (let index = 0; index < text.length; index++) {
    escaped += text[index] === '|' && !isEscaped(text, index) ? '\\|' : text[index];
  }
  return escaped;
}

/** Escapes only table-delimiter pipes that occur in a syntactically complete inline code span. */
function normalizeTableRow(line: string): string {
  let normalized = '';
  let index = 0;

  while (index < line.length) {
    if (line[index] !== '`' || isEscaped(line, index)) {
      normalized += line[index++];
      continue;
    }

    const length = getBacktickLength(line, index);
    const closingIndex = findClosingBackticks(line, index, length);
    if (closingIndex === -1) {
      normalized += line.slice(index, index + length);
      index += length;
      continue;
    }

    const marker = line.slice(index, index + length);
    const codeContent = escapeCodeSpanPipes(line.slice(index + length, closingIndex));
    normalized += `${marker}${codeContent}${marker}`;
    index = closingIndex + length;
  }

  return normalized;
}

/** Determines whether a line is a GFM table separator row. */
function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) {
    return false;
  }

  const cells = trimmed.replace(/^\|/, '').replace(/\|$/, '').split('|');
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell.trim()));
}

/** Returns a Markdown fence marker when the line begins or closes a fenced code block. */
function getFenceMarker(line: string): FenceMarker | null {
  const match = line.match(/^ {0,3}(`{3,}|~{3,})/);
  if (!match) {
    return null;
  }

  return {
    character: match[1][0] as FenceMarker['character'],
    length: match[1].length,
  };
}

/**
 * Escapes valid code-span pipes in GFM table rows before tokenization.
 *
 * `markdown-it` recognizes escaped pipes but not pipes inside backtick code spans when it splits
 * table cells. Keeping malformed delimiters unescaped means an invalid code span cannot consume the
 * remaining row and collapse its columns.
 *
 * @param source Raw Markdown source.
 * @returns Source normalized only where the parser's table tokenizer needs the extra context.
 */
export function normalizeMarkdownTables(source: string): string {
  const lines = source.split('\n');
  let activeFence: FenceMarker | null = null;

  for (let index = 0; index < lines.length; index++) {
    const fence = getFenceMarker(lines[index]);
    if (activeFence) {
      if (
        fence &&
        fence.character === activeFence.character &&
        fence.length >= activeFence.length
      ) {
        activeFence = null;
      }
      continue;
    }

    if (fence) {
      activeFence = fence;
      continue;
    }

    if (!isTableSeparator(lines[index]) || !lines[index - 1]?.includes('|')) {
      continue;
    }

    lines[index - 1] = normalizeTableRow(lines[index - 1]);
    while (index + 1 < lines.length && lines[index + 1].includes('|')) {
      index++;
      lines[index] = normalizeTableRow(lines[index]);
    }
  }

  return lines.join('\n');
}
