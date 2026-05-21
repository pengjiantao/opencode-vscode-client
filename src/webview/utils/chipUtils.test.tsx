/**
 * @file Regression tests for prompt chip serialization helpers.
 */

import { describe, expect, it } from 'vitest';
import { getChipDisplayLabel, truncateMiddle } from './chipUtils';

describe('truncateMiddle', () => {
  it('does not truncate strings shorter than or equal to maxLength', () => {
    expect(truncateMiddle('short.ts', 15)).toBe('short.ts');
    expect(truncateMiddle('exactly-15-chars.ts', 19)).toBe('exactly-15-chars.ts');
  });

  it('truncates long strings in the middle, preserving extension', () => {
    // 59 characters
    const longName = 'very-long-filename-that-needs-truncation-to-fit-perfectly.ts';
    // Max length 32: prefix=15, suffix=14
    // prefix: "very-long-filen" (15 chars)
    // suffix: "t-perfectly.ts" (14 chars)
    expect(truncateMiddle(longName, 32)).toBe('very-long-filen...t-perfectly.ts');
  });
});

describe('getChipDisplayLabel', () => {
  it('formats short file chip labels normally', () => {
    expect(getChipDisplayLabel('file', 'file.txt')).toBe('file.txt');
  });

  it('middle-truncates long file and image chip labels', () => {
    const longName = 'very-long-filename-that-needs-truncation-to-fit-perfectly.ts';
    expect(getChipDisplayLabel('file', longName)).toBe('very-long-filen...t-perfectly.ts');
    expect(getChipDisplayLabel('image', longName)).toBe('very-long-filen...t-perfectly.ts');
  });

  it('formats text chips with line counts', () => {
    expect(getChipDisplayLabel('text', undefined, 5)).toBe('Pasted 5 Lines');
  });

  it('formats code-selection chips, preserving line ranges and middle-truncating filename', () => {
    const longName = 'very-long-filename-that-needs-truncation-to-fit-perfectly.ts';
    // Filename portion max length 24: prefix=11 ("very-long-f"), suffix=10 ("rfectly.ts")
    // Total label should be "very-long-f...rfectly.ts [10-20]"
    expect(getChipDisplayLabel('code-selection', longName, undefined, 10, 20)).toBe(
      'very-long-f...rfectly.ts [10-20]',
    );

    // If filename already contains line range
    expect(
      getChipDisplayLabel(
        'code-selection',
        'very-long-filename-that-needs-truncation-to-fit-perfectly.ts [10-20]',
      ),
    ).toBe('very-long-f...rfectly.ts [10-20]');
  });

  it('formats terminal chips', () => {
    expect(getChipDisplayLabel('terminal', undefined, 15)).toBe('terminal[15 lines]');
    expect(getChipDisplayLabel('terminal', 'terminal [20 lines]')).toBe('terminal [20 lines]');
  });

  it('middle-truncates long command and skill chip labels', () => {
    const longCommand = '/explain-this-extremely-long-command-name-to-me-please';
    expect(getChipDisplayLabel('command', longCommand)).toBe('/explain-this-e...e-to-me-please');
    expect(getChipDisplayLabel('skill', longCommand)).toBe('/explain-this-e...e-to-me-please');
  });
});
