/**
 * @file Unit tests for the unified diff parsing utility.
 */

import { describe, expect, it } from 'vitest';
import { parseDiff } from './diff-parser';

describe('diff-parser', () => {
  it('parses a simple single-file unified diff with additions and deletions', () => {
    const diffText = `
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,5 +1,6 @@
 import { foo } from './foo';
-const x = 10;
+const x = 20;
+const y = 30;
 console.log(x);
 `;

    const parsed = parseDiff(diffText.trim());

    expect(parsed.oldFile).toBe('src/index.ts');
    expect(parsed.newFile).toBe('src/index.ts');
    expect(parsed.hunks).toHaveLength(1);

    const hunk = parsed.hunks[0];
    expect(hunk.header).toBe('@@ -1,5 +1,6 @@');
    expect(hunk.lines).toHaveLength(5);

    // Context line 1
    expect(hunk.lines[0]).toEqual({
      type: 'context',
      content: "import { foo } from './foo';",
      oldLineNumber: 1,
      newLineNumber: 1,
    });

    // Removed line
    expect(hunk.lines[1]).toEqual({
      type: 'removed',
      content: 'const x = 10;',
      oldLineNumber: 2,
      newLineNumber: null,
    });

    // Added lines
    expect(hunk.lines[2]).toEqual({
      type: 'added',
      content: 'const x = 20;',
      oldLineNumber: null,
      newLineNumber: 2,
    });
    expect(hunk.lines[3]).toEqual({
      type: 'added',
      content: 'const y = 30;',
      oldLineNumber: null,
      newLineNumber: 3,
    });

    // Context line 2
    expect(hunk.lines[4]).toEqual({
      type: 'context',
      content: 'console.log(x);',
      oldLineNumber: 3,
      newLineNumber: 4,
    });
  });

  it('parses a new file diff (all additions)', () => {
    const diffText = `
--- /dev/null
+++ b/src/new-file.ts
@@ -0,0 +1,2 @@
+const firstLine = true;
+console.log(firstLine);
`;

    const parsed = parseDiff(diffText.trim());

    expect(parsed.oldFile).toBe('/dev/null');
    expect(parsed.newFile).toBe('src/new-file.ts');
    expect(parsed.hunks).toHaveLength(1);

    const hunk = parsed.hunks[0];
    expect(hunk.lines).toHaveLength(2);

    expect(hunk.lines[0]).toEqual({
      type: 'added',
      content: 'const firstLine = true;',
      oldLineNumber: null,
      newLineNumber: 1,
    });
    expect(hunk.lines[1]).toEqual({
      type: 'added',
      content: 'console.log(firstLine);',
      oldLineNumber: null,
      newLineNumber: 2,
    });
  });

  it('parses multi-hunk diffs correctly', () => {
    const diffText = `
--- a/src/multi.ts
+++ b/src/multi.ts
@@ -10,3 +10,4 @@
 line 10
-line 11
+line 11 modified
 line 12
@@ -40,2 +41,3 @@
 line 40
+line 40.5
 line 41
`;

    const parsed = parseDiff(diffText.trim());

    expect(parsed.hunks).toHaveLength(2);

    // Hunk 1
    const hunk1 = parsed.hunks[0];
    expect(hunk1.header).toBe('@@ -10,3 +10,4 @@');
    expect(hunk1.lines[1].oldLineNumber).toBe(11);
    expect(hunk1.lines[1].newLineNumber).toBeNull();
    expect(hunk1.lines[2].oldLineNumber).toBeNull();
    expect(hunk1.lines[2].newLineNumber).toBe(11);

    // Hunk 2
    const hunk2 = parsed.hunks[1];
    expect(hunk2.header).toBe('@@ -40,2 +41,3 @@');
    expect(hunk2.lines[0].oldLineNumber).toBe(40);
    expect(hunk2.lines[0].newLineNumber).toBe(41);
    expect(hunk2.lines[1].newLineNumber).toBe(42);
  });

  it('ignores git headers and index metadata lines', () => {
    const diffText = `
diff --git a/src/git.ts b/src/git.ts
index 123456..789abc 100644
--- a/src/git.ts
+++ b/src/git.ts
@@ -1,2 +1,2 @@
-old
+new
`;

    const parsed = parseDiff(diffText.trim());
    expect(parsed.oldFile).toBe('src/git.ts');
    expect(parsed.newFile).toBe('src/git.ts');
    expect(parsed.hunks).toHaveLength(1);
    expect(parsed.hunks[0].lines).toHaveLength(2);
  });
});
