/**
 * @file Tests for path display utilities.
 */

import { describe, expect, it } from 'vitest';
import { toDisplayPath } from './path-utils';

describe('toDisplayPath', () => {
  it('returns relative path when file is within workspace', () => {
    expect(toDisplayPath('/home/user/project/src/foo.ts', '/home/user/project')).toBe('src/foo.ts');
  });

  it('returns relative path for nested files', () => {
    expect(
      toDisplayPath('/home/user/project/src/components/Button.tsx', '/home/user/project'),
    ).toBe('src/components/Button.tsx');
  });

  it('returns "." when file equals workspace root', () => {
    expect(toDisplayPath('/home/user/project', '/home/user/project')).toBe('.');
  });

  it('returns absolute path when file is outside workspace', () => {
    expect(toDisplayPath('/home/user/other/foo.ts', '/home/user/project')).toBe(
      '/home/user/other/foo.ts',
    );
  });

  it('returns original path when workspaceRoot is null', () => {
    expect(toDisplayPath('/home/user/project/src/foo.ts', null)).toBe(
      '/home/user/project/src/foo.ts',
    );
  });

  it('returns original path when filePath is empty', () => {
    expect(toDisplayPath('', '/home/user/project')).toBe('');
  });

  it('handles Windows-style paths with backslashes', () => {
    expect(toDisplayPath('C:\\Users\\project\\src\\foo.ts', 'C:\\Users\\project')).toBe(
      'src/foo.ts',
    );
  });

  it('handles mixed path separators', () => {
    expect(toDisplayPath('C:\\Users/project\\src/foo.ts', 'C:\\Users/project')).toBe('src/foo.ts');
  });

  it('handles workspace root without trailing slash', () => {
    expect(toDisplayPath('/home/user/project/src/foo.ts', '/home/user/project')).toBe('src/foo.ts');
  });

  it('handles workspace root with trailing slash', () => {
    expect(toDisplayPath('/home/user/project/src/foo.ts', '/home/user/project/')).toBe(
      'src/foo.ts',
    );
  });

  it('does not match partial directory names', () => {
    // /home/user/project2 should NOT match /home/user/project
    expect(toDisplayPath('/home/user/project2/foo.ts', '/home/user/project')).toBe(
      '/home/user/project2/foo.ts',
    );
  });
});
