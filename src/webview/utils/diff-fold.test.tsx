/**
 * @file Unit tests for the diff-fold utility.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { _clearSegmentCacheForTests, buildSegments } from './diff-fold';
import type { DiffHunk } from './diff-parser';

/**
 * Helper to create a DiffHunk with realistic line numbers.
 * Parses the hunk header to determine correct old/new line numbers.
 */
function makeHunk(
  header: string,
  lines: Array<{ type: 'context' | 'added' | 'removed'; content: string }>,
): DiffHunk {
  const match = header.match(/@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
  const oldStart = match ? parseInt(match[1], 10) : 1;
  const newStart = match ? parseInt(match[2], 10) : 1;

  let oldLine = oldStart;
  let newLine = newStart;

  const diffLines = lines.map((l) => {
    if (l.type === 'context') {
      return {
        type: 'context' as const,
        content: l.content,
        oldLineNumber: oldLine++,
        newLineNumber: newLine++,
      };
    }
    if (l.type === 'removed') {
      return {
        type: 'removed' as const,
        content: l.content,
        oldLineNumber: oldLine++,
        newLineNumber: null,
      };
    }
    return {
      type: 'added' as const,
      content: l.content,
      oldLineNumber: null,
      newLineNumber: newLine++,
    };
  });

  return { header, lines: diffLines };
}

/** Shorthand helpers for line creation. */
const C = (content: string) => ({ type: 'context' as const, content });
const A = (content: string) => ({ type: 'added' as const, content });
const R = (content: string) => ({ type: 'removed' as const, content });

describe('buildSegments', () => {
  beforeEach(() => {
    // Each test creates fresh hunks arrays, but clearing the cache keeps
    // memory bounded and matches the LRU eviction behavior under load.
    _clearSegmentCacheForTests();
  });

  it('returns empty array for no hunks', () => {
    expect(buildSegments([])).toEqual([]);
  });

  it('returns a single visible segment for a single hunk with only changes', () => {
    const hunks = [makeHunk('@@ -1,2 +1,2 @@', [R('old'), A('new')])];
    const segments = buildSegments(hunks);
    // Header + 2 change lines = all visible, no collapsed
    const collapsedCount = segments.filter((s) => s.type === 'collapsed').length;
    expect(collapsedCount).toBe(0);
  });

  it('folds long context blocks within a hunk', () => {
    // Hunk with 10 context lines, a change in the middle, 10 more context
    const lines = [
      ...Array.from({ length: 10 }, (_, i) => C(`ctx-before-${i}`)),
      R('removed-line'),
      A('added-line'),
      ...Array.from({ length: 10 }, (_, i) => C(`ctx-after-${i}`)),
    ];
    const hunks = [makeHunk('@@ -1,22 +1,22 @@', lines)];
    const segments = buildSegments(hunks, 3);

    // Should have: header, visible(3 ctx before), collapsed(7), visible(removed+added), collapsed(7), visible(3 ctx after)
    const collapsedCount = segments.filter((s) => s.type === 'collapsed').length;
    expect(collapsedCount).toBe(2);

    const collapsed = segments.filter((s) => s.type === 'collapsed');
    expect(collapsed[0]).toMatchObject({ type: 'collapsed', count: 7 });
    expect(collapsed[1]).toMatchObject({ type: 'collapsed', count: 7 });
  });

  it('keeps all context visible when hunk is small', () => {
    // Only 4 context lines total around a change — all should be visible with contextLines=3
    const lines = [C('ctx1'), C('ctx2'), R('removed'), A('added'), C('ctx3'), C('ctx4')];
    const hunks = [makeHunk('@@ -1,6 +1,6 @@', lines)];
    const segments = buildSegments(hunks, 3);

    const collapsedCount = segments.filter((s) => s.type === 'collapsed').length;
    expect(collapsedCount).toBe(0);
  });

  it('handles multiple changes in a hunk', () => {
    // Two separate changes with a large gap between them
    const lines = [
      C('ctx-start-1'),
      C('ctx-start-2'),
      C('ctx-start-3'),
      R('removed-1'),
      A('added-1'),
      ...Array.from({ length: 10 }, (_, i) => C(`gap-${i}`)),
      R('removed-2'),
      A('added-2'),
      C('ctx-end-1'),
      C('ctx-end-2'),
      C('ctx-end-3'),
    ];
    const hunks = [makeHunk('@@ -1,21 +1,21 @@', lines)];
    const segments = buildSegments(hunks, 3);

    // The 10-line gap between the two changes should be collapsed
    const collapsedCount = segments.filter((s) => s.type === 'collapsed').length;
    expect(collapsedCount).toBe(1);

    const collapsed = segments.filter((s) => s.type === 'collapsed');
    expect(collapsed[0]).toMatchObject({ type: 'collapsed', count: 4 }); // 10 - 3 - 3 = 4
  });

  it('folds context at the start of a hunk (before first change)', () => {
    const lines = [
      ...Array.from({ length: 10 }, (_, i) => C(`leading-${i}`)),
      R('removed'),
      A('added'),
    ];
    const hunks = [makeHunk('@@ -1,12 +1,12 @@', lines)];
    const segments = buildSegments(hunks, 3);

    // 10 leading context - 3 visible = 7 collapsed
    const collapsed = segments.filter((s) => s.type === 'collapsed');
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]).toMatchObject({ type: 'collapsed', count: 7 });
  });

  it('folds context at the end of a hunk (after last change)', () => {
    const lines = [
      R('removed'),
      A('added'),
      ...Array.from({ length: 10 }, (_, i) => C(`trailing-${i}`)),
    ];
    const hunks = [makeHunk('@@ -1,12 +1,12 @@', lines)];
    const segments = buildSegments(hunks, 3);

    // 10 trailing context - 3 visible = 7 collapsed
    const collapsed = segments.filter((s) => s.type === 'collapsed');
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]).toMatchObject({ type: 'collapsed', count: 7 });
  });

  it('handles multiple hunks each with folding', () => {
    const hunk1Lines = [
      ...Array.from({ length: 8 }, (_, i) => C(`h1-ctx-${i}`)),
      R('h1-removed'),
      A('h1-added'),
      ...Array.from({ length: 8 }, (_, i) => C(`h1-trail-${i}`)),
    ];
    const hunk2Lines = [
      ...Array.from({ length: 8 }, (_, i) => C(`h2-ctx-${i}`)),
      R('h2-removed'),
      A('h2-added'),
      ...Array.from({ length: 8 }, (_, i) => C(`h2-trail-${i}`)),
    ];

    const hunks = [
      makeHunk('@@ -1,18 +1,18 @@', hunk1Lines),
      makeHunk('@@ -30,18 +30,18 @@', hunk2Lines),
    ];
    const segments = buildSegments(hunks, 3);

    // Each hunk should have collapsed blocks
    const collapsed = segments.filter((s) => s.type === 'collapsed');
    expect(collapsed.length).toBeGreaterThanOrEqual(2);
  });

  it('returns the same array instance for repeated calls with the same hunks reference', () => {
    const hunks = [makeHunk('@@ -1,2 +1,2 @@', [R('old'), A('new')])];
    const first = buildSegments(hunks);
    const second = buildSegments(hunks);
    // Caching returns the exact same reference, allowing React's useMemo
    // downstream to skip re-rendering the diff entirely.
    expect(second).toBe(first);
  });
});
