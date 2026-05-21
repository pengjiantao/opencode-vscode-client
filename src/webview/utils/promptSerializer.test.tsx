/**
 * @file Regression tests for prompt serialization helpers.
 */

import { describe, expect, it } from 'vitest';
import { getPromptData } from './promptSerializer';

describe('getPromptData', () => {
  it('regression: serializes skill chips at their inline prompt placeholder position', () => {
    const editor = document.createElement('div');
    const chip = document.createElement('span');
    chip.className = 'opencode-chip skill-chip inline-chip';
    chip.setAttribute('data-chip-id', 'skill-1');
    chip.setAttribute('data-chip-type', 'skill');
    chip.setAttribute('data-chip-filename', 'code-review');
    chip.setAttribute('data-chip-text', 'Review the selected code for quality issues.');
    chip.setAttribute('data-chip-skill-description', 'Review quality');

    editor.appendChild(document.createTextNode('Use '));
    editor.appendChild(chip);
    editor.appendChild(document.createTextNode(' to review vm-module'));

    const result = getPromptData(editor, 'session-1', {});
    const skillPart = result.parts[0] as {
      type: 'text';
      text: string;
      metadata?: { type?: string; name?: string; description?: string };
    };

    expect(result.text).toBe('Use [Skill: code-review] to review vm-module');
    expect(result.parts).toHaveLength(1);
    expect(skillPart.type).toBe('text');
    expect(skillPart.text).toBe('Review the selected code for quality issues.');
    expect(skillPart.metadata).toEqual({
      type: 'skill',
      name: 'code-review',
      description: 'Review quality',
      placeholder: '[Skill: code-review]',
      startOffset: 4,
      endOffset: 24,
    });
  });
});
