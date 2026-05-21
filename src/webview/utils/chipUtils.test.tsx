/**
 * @file Regression tests for prompt chip serialization helpers.
 */

import { describe, expect, it } from 'vitest';
import {
  getChipDisplayLabel,
  getTooltipHtml,
  parseMarkdownToHtml,
  truncateMiddle,
} from './chipUtils';

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

describe('parseMarkdownToHtml', () => {
  it('parses headers correctly', () => {
    expect(parseMarkdownToHtml('# Header 1')).toBe('<h1 class="tooltip-markdown-h1">Header 1</h1>');
    expect(parseMarkdownToHtml('## Header 2')).toBe(
      '<h2 class="tooltip-markdown-h2">Header 2</h2>',
    );
  });

  it('parses lists correctly', () => {
    const md = '- Item 1\n- Item 2';
    expect(parseMarkdownToHtml(md)).toBe(
      '<ul class="tooltip-markdown-list"><li>Item 1</li><li>Item 2</li></ul>',
    );
  });

  it('parses inline markup (bold, italic, inline code, links) correctly', () => {
    expect(parseMarkdownToHtml('**bold** and *italic*')).toBe(
      '<p class="tooltip-markdown-p"><strong>bold</strong> and <em>italic</em></p>',
    );
    expect(parseMarkdownToHtml('`code` and [link](https://url)')).toBe(
      '<p class="tooltip-markdown-p"><code class="tooltip-markdown-inline-code">code</code> and <a href="https://url" target="_blank" rel="noopener noreferrer" class="markdown-link">link</a></p>',
    );
  });

  it('neutralizes unsafe link protocols (like javascript:)', () => {
    expect(parseMarkdownToHtml('click [here](javascript:x)')).toBe(
      '<p class="tooltip-markdown-p">click here</p>',
    );
  });

  it('parses nested bold-italic correctly', () => {
    expect(parseMarkdownToHtml('***bold italic***')).toBe(
      '<p class="tooltip-markdown-p"><strong><em>bold italic</em></strong></p>',
    );
  });

  it('parses code blocks correctly', () => {
    const md = '```js\nconst a = 1;\n```';
    expect(parseMarkdownToHtml(md)).toBe(
      '<pre class="tooltip-markdown-code"><code>const a = 1;\n</code></pre>',
    );
  });
});

describe('getTooltipHtml', () => {
  const fileInfos = {};

  it('returns clean markdown container for skill chip', () => {
    const chip = {
      type: 'skill' as const,
      filename: 'test-skill',
      text: '# Skill Description\n- Detail 1',
    };
    const html = getTooltipHtml(chip, fileInfos);
    expect(html).toContain('<strong>Skill: test-skill</strong>');
    expect(html).toContain('<div class="tooltip-markdown-content">');
    expect(html).toContain('<h1 class="tooltip-markdown-h1">Skill Description</h1>');
    expect(html).toContain('<li>Detail 1</li>');
  });

  it('returns direct text without containers for terminal, code-selection, text, and file chips', () => {
    const terminalChip = {
      type: 'terminal' as const,
      text: 'some terminal log\nline 2',
    };
    expect(getTooltipHtml(terminalChip, fileInfos)).toBe(
      '<div class="tooltip-text-direct">some terminal log\nline 2</div>',
    );

    const selectionChip = {
      type: 'code-selection' as const,
      text: 'const x = 5;',
    };
    expect(getTooltipHtml(selectionChip, fileInfos)).toBe(
      '<div class="tooltip-text-direct">const x = 5;</div>',
    );

    const textChip = {
      type: 'text' as const,
      text: 'just plain text',
    };
    expect(getTooltipHtml(textChip, fileInfos)).toBe(
      '<div class="tooltip-text-direct">just plain text</div>',
    );

    const fileChip = {
      type: 'file' as const,
      text: 'file contents',
    };
    expect(getTooltipHtml(fileChip, fileInfos)).toBe(
      '<div class="tooltip-text-direct">file contents</div>',
    );
  });
});
