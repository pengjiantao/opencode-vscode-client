/**
 * @file Unit tests for GFM table code-span normalization before markdown-it tokenization.
 */

import { describe, expect, it } from 'vitest';
import { normalizeMarkdownTables } from './markdownTableNormalizer';

describe('normalizeMarkdownTables', () => {
  it('escapes pipes inside matching inline code spans without changing table borders', () => {
    const source = [
      '| Command | Description |',
      '| --- | --- |',
      '| `grep | sort` | Pipeline |',
    ].join('\n');

    expect(normalizeMarkdownTables(source)).toBe(
      ['| Command | Description |', '| --- | --- |', '| `grep \\| sort` | Pipeline |'].join('\n'),
    );
  });

  it('preserves pipes preceded by an odd number of backslashes', () => {
    const source = ['| Command |', '| --- |', '| `grep \\| sort` |'].join('\n');

    expect(normalizeMarkdownTables(source)).toBe(source);
  });

  it('escapes pipes preceded by an even number of backslashes', () => {
    const codeSpan = `\`grep ${'\\'.repeat(2)}| sort\``;
    const expectedCodeSpan = `\`grep ${'\\'.repeat(3)}| sort\``;
    const source = ['| Command |', '| --- |', `| ${codeSpan} |`].join('\n');

    expect(normalizeMarkdownTables(source)).toBe(
      ['| Command |', '| --- |', `| ${expectedCodeSpan} |`].join('\n'),
    );
  });

  it('preserves unclosed code delimiters so malformed syntax cannot collapse table columns', () => {
    const source = [
      '| Module | Description | Reference |',
      '| --- | --- | --- |',
      '| **`agent_stats/`` | Agent usage statistics | - |',
    ].join('\n');

    expect(normalizeMarkdownTables(source)).toBe(source);
  });

  it('does not alter table-shaped content inside fenced code blocks', () => {
    const source = [
      '```markdown',
      '| Command | Description |',
      '| --- | --- |',
      '| `grep | sort` | Pipeline |',
      '```',
    ].join('\n');

    expect(normalizeMarkdownTables(source)).toBe(source);
  });
});
