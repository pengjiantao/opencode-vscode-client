/**
 * @file Unit tests for gitignore.ts.
 * Verifies character-by-character parsing and path matching correctness.
 */

import { describe, expect, it } from 'vitest';
import type { GitignorePattern } from './gitignore';
import { isPathIgnored, parseGitignoreLine } from './gitignore';

describe('gitignore helper utilities', () => {
  describe('parseGitignoreLine', () => {
    it('should ignore empty lines and comments', () => {
      expect(parseGitignoreLine('')).toBeNull();
      expect(parseGitignoreLine('   ')).toBeNull();
      expect(parseGitignoreLine('# comment')).toBeNull();
    });

    it('should parse simple file matching', () => {
      const pattern = parseGitignoreLine('*.log');
      expect(pattern).not.toBeNull();
      expect(pattern!.isNegation).toBe(false);
      expect(pattern!.isDirectoryOnly).toBe(false);
      expect(pattern!.regex.test('debug.log')).toBe(true);
      expect(pattern!.regex.test('dir/debug.log')).toBe(true);
      expect(pattern!.regex.test('debug.log.txt')).toBe(false);
    });

    it('should parse negation correctly', () => {
      const pattern = parseGitignoreLine('!important.log');
      expect(pattern).not.toBeNull();
      expect(pattern!.isNegation).toBe(true);
      expect(pattern!.regex.test('important.log')).toBe(true);
    });

    it('should parse directory-only matching', () => {
      const pattern = parseGitignoreLine('dist/');
      expect(pattern).not.toBeNull();
      expect(pattern!.isDirectoryOnly).toBe(true);
      expect(pattern!.regex.test('dist')).toBe(true);
      expect(pattern!.regex.test('dist/bundle.js')).toBe(true);
    });

    it('should handle unescaped space trimming and escaped spaces', () => {
      const pattern = parseGitignoreLine('file\\ name.txt  ');
      expect(pattern).not.toBeNull();
      expect(pattern!.regex.test('file name.txt')).toBe(true);
    });

    it('should parse escaped characters literally', () => {
      const hashPattern = parseGitignoreLine('\\#hash.txt');
      expect(hashPattern).not.toBeNull();
      expect(hashPattern!.regex.test('#hash.txt')).toBe(true);

      const exclPattern = parseGitignoreLine('\\!excl.txt');
      expect(exclPattern).not.toBeNull();
      expect(exclPattern!.isNegation).toBe(false);
      expect(exclPattern!.regex.test('!excl.txt')).toBe(true);
    });
  });

  describe('isPathIgnored', () => {
    it('should correctly evaluate standard gitignore rules', () => {
      const patternsStr = [
        '*.log',
        '!important.log',
        '\\#hash.txt',
        '\\!exclamation.txt',
        '/ignored-dir/',
        '!/ignored-dir/sub.txt',
      ];
      const patterns = patternsStr.map(parseGitignoreLine).filter(Boolean) as GitignorePattern[];

      expect(isPathIgnored('normal.log', false, patterns)).toBe(true);
      expect(isPathIgnored('important.log', false, patterns)).toBe(false);
      expect(isPathIgnored('#hash.txt', false, patterns)).toBe(true);
      expect(isPathIgnored('!exclamation.txt', false, patterns)).toBe(true);
      expect(isPathIgnored('ignored-dir/sub.txt', false, patterns)).toBe(true); // Parent directory is excluded
      expect(isPathIgnored('safe.txt', false, patterns)).toBe(false);
    });
  });
});
