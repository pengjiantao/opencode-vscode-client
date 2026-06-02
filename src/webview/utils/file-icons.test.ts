/**
 * @file Unit tests for the file-icon resolution helpers in file-icons.ts.
 */

import { describe, expect, it } from 'vitest';
import { getDirectory, getFileIconName, getFileIconUrl, getFilename } from './file-icons';

describe('getFilename / getDirectory', () => {
  it('splits forward-slash paths', () => {
    expect(getFilename('src/utils/helper.ts')).toBe('helper.ts');
    expect(getDirectory('src/utils/helper.ts')).toBe('src/utils');
  });

  it('splits back-slash paths (normalizing to forward slashes)', () => {
    expect(getFilename('C:\\proj\\index.jsx')).toBe('index.jsx');
    // getDirectory normalizes separators so the result is portable.
    expect(getDirectory('C:\\proj\\index.jsx')).toBe('C:/proj');
  });

  it('returns the input for filename when there is no separator', () => {
    expect(getFilename('README.md')).toBe('README.md');
    expect(getDirectory('README.md')).toBe('');
  });
});

describe('getFileIconName', () => {
  it.each([
    // TypeScript / JavaScript
    ['src/utils/helper.ts', 'typescript'],
    ['app.tsx', 'react_ts'],
    ['script.mts', 'typescript'],
    ['script.cts', 'typescript'],
    ['index.js', 'javascript'],
    ['component.jsx', 'react'],
    ['module.mjs', 'javascript'],
    // Web / styling
    ['page.html', 'html'],
    ['app.vue', 'vue'],
    ['app.svelte', 'svelte'],
    ['styles.css', 'css'],
    ['styles.scss', 'sass'],
    ['styles.sass', 'sass'],
    ['styles.less', 'less'],
    // Source code
    ['main.py', 'python'],
    ['app.rb', 'ruby'],
    ['index.php', 'php'],
    ['main.go', 'go'],
    ['main.rs', 'rust'],
    ['App.java', 'java'],
    ['main.c', 'c'],
    ['main.h', 'c'],
    ['main.cpp', 'cpp'],
    ['main.hpp', 'cpp'],
    ['script.swift', 'swift'],
    ['app.kt', 'kotlin'],
    // Data / config
    ['tsconfig.json', 'json'],
    ['package.json', 'json'],
    ['config.yaml', 'yaml'],
    ['config.yml', 'yaml'],
    ['pyproject.toml', 'toml'],
    ['data.xml', 'xml'],
    // Docs
    ['README.md', 'markdown'],
    ['paper.tex', 'tex'],
    // Build / tooling
    ['Dockerfile', 'docker'],
    ['dockerfile', 'docker'],
    ['Makefile', 'makefile'],
    ['Jenkinsfile', 'docker'],
    ['script.ps1', 'powershell'],
    // Images (fall back to generic `image`)
    ['logo.png', 'image'],
    ['photo.JPG', 'image'],
    ['icon.svg', 'svg'],
    ['favicon.ico', 'favicon'],
    // Media
    ['song.mp3', 'audio'],
    ['clip.mp4', 'video'],
    // Archives
    ['release.zip', 'zip'],
    ['backup.tar.gz', 'zip'],
    // Binary
    ['app.exe', 'exe'],
    ['lib.dll', 'dll'],
    // Database
    ['schema.sql', 'database'],
    // Other
    ['LICENSE', 'license'],
    ['README', 'markdown'],
    // Compound suffixes
    ['types.d.ts', 'typescript'],
    ['types.d.tsx', 'react_ts'],
    ['foo.test.ts', 'typescript'],
    ['foo.test.tsx', 'react_ts'],
  ])('maps %s to icon %s', (input, expected) => {
    expect(getFileIconName(input)).toBe(expected);
  });

  it('handles Windows-style paths', () => {
    expect(getFileIconName('C:\\Users\\me\\app.tsx')).toBe('react_ts');
  });

  it('handles dotfiles by falling back to undefined', () => {
    // No real extension after the leading dot.
    expect(getFileIconName('.gitignore')).toBeUndefined();
  });

  it('handles empty or missing paths', () => {
    expect(getFileIconName('')).toBeUndefined();
    expect(getFileIconName(undefined)).toBeUndefined();
  });

  it('returns undefined for unknown extensions', () => {
    expect(getFileIconName('weird.zzznotreal')).toBeUndefined();
  });

  it('is case-insensitive for the extension and basename', () => {
    expect(getFileIconName('Foo.TS')).toBe('typescript');
    expect(getFileIconName('DOCKERFILE')).toBe('docker');
  });
});

describe('getFileIconUrl', () => {
  it('returns a string URL for a known extension', () => {
    const url = getFileIconUrl('helper.ts');
    expect(typeof url).toBe('string');
    expect(url!.length).toBeGreaterThan(0);
  });

  it('returns undefined for an unknown extension', () => {
    expect(getFileIconUrl('weird.zzznotreal')).toBeUndefined();
  });

  it('returns undefined for an empty path', () => {
    expect(getFileIconUrl('')).toBeUndefined();
    expect(getFileIconUrl(undefined)).toBeUndefined();
  });
});
