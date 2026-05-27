/**
 * @file Tests for the editorRestore utility.
 * Verifies that user message parts are correctly restored into the prompt input editor.
 */

import type { Part } from '@opencode-ai/sdk/v2/client';
import { describe, expect, it } from 'vitest';
import { restoreUserMessageToEditor } from './editorRestore';

function makeTextPart(id: string, text: string, metadata?: Record<string, unknown>): Part {
  return {
    id,
    type: 'text',
    text,
    sessionID: 'test-session',
    messageID: 'test-msg',
    ...(metadata ? { metadata } : {}),
  } as unknown as Part;
}

function makeFilePart(
  id: string,
  filename: string,
  mime: string,
  url: string,
  source?: Record<string, unknown>,
): Part {
  return {
    id,
    type: 'file',
    filename,
    mime,
    url,
    sessionID: 'test-session',
    messageID: 'test-msg',
    ...(source ? { source } : {}),
  } as unknown as Part;
}

describe('restoreUserMessageToEditor', () => {
  it('restores plain text into the editor', () => {
    const editor = document.createElement('div');
    const parts = [makeTextPart('t1', 'Hello world')];

    restoreUserMessageToEditor(editor, parts);

    expect(editor.textContent).toBe('Hello world');
    expect(editor.querySelectorAll('.opencode-chip')).toHaveLength(0);
  });

  it('restores text with a file chip placeholder', () => {
    const editor = document.createElement('div');
    const parts = [
      makeTextPart('t1', 'Please review [File: main.ts] for issues'),
      makeFilePart('f1', 'main.ts', 'text/plain', 'file:///main.ts'),
    ];

    restoreUserMessageToEditor(editor, parts);

    expect(editor.textContent).toContain('Please review');
    expect(editor.textContent).toContain('for issues');
    const chips = editor.querySelectorAll('.opencode-chip');
    expect(chips).toHaveLength(1);
    expect(chips[0].getAttribute('data-chip-type')).toBe('file');
    expect(chips[0].getAttribute('data-chip-filename')).toBe('main.ts');
  });

  it('restores text with an image chip placeholder', () => {
    const editor = document.createElement('div');
    const parts = [
      makeTextPart('t1', 'Look at [Image: screenshot.png]'),
      makeFilePart('f1', 'screenshot.png', 'image/png', 'data:image/png;base64,abc'),
    ];

    restoreUserMessageToEditor(editor, parts);

    const chips = editor.querySelectorAll('.opencode-chip');
    expect(chips).toHaveLength(1);
    expect(chips[0].getAttribute('data-chip-type')).toBe('image');
  });

  it('restores command chip from inline metadata part', () => {
    const editor = document.createElement('div');
    const parts = [
      makeTextPart('t1', 'Use [Command: explain] to explain the code', {
        type: 'display',
      }),
      makeTextPart('t2', 'explain', {
        type: 'command',
        command: 'explain',
        placeholder: '[Command: explain]',
      }),
    ];

    restoreUserMessageToEditor(editor, parts);

    const chips = editor.querySelectorAll('.opencode-chip');
    expect(chips).toHaveLength(1);
    expect(chips[0].getAttribute('data-chip-type')).toBe('command');
    expect(chips[0].getAttribute('data-chip-filename')).toBe('explain');
  });

  it('restores skill chip from inline metadata part', () => {
    const editor = document.createElement('div');
    const parts = [
      makeTextPart('t1', 'Apply [Skill: code-review] to this file', {
        type: 'display',
      }),
      makeTextPart('t2', 'code-review content', {
        type: 'skill',
        name: 'code-review',
        placeholder: '[Skill: code-review]',
      }),
    ];

    restoreUserMessageToEditor(editor, parts);

    const chips = editor.querySelectorAll('.opencode-chip');
    expect(chips).toHaveLength(1);
    expect(chips[0].getAttribute('data-chip-type')).toBe('skill');
    expect(chips[0].getAttribute('data-chip-filename')).toBe('code-review');
  });

  it('restores multiple chips in correct order', () => {
    const editor = document.createElement('div');
    const parts = [
      makeTextPart('t1', 'Review [File: a.ts] and [File: b.ts]'),
      makeFilePart('f1', 'a.ts', 'text/plain', 'file:///a.ts'),
      makeFilePart('f2', 'b.ts', 'text/plain', 'file:///b.ts'),
    ];

    restoreUserMessageToEditor(editor, parts);

    const chips = editor.querySelectorAll('.opencode-chip');
    expect(chips).toHaveLength(2);
    expect(chips[0].getAttribute('data-chip-filename')).toBe('a.ts');
    expect(chips[1].getAttribute('data-chip-filename')).toBe('b.ts');
  });

  it('clears existing editor content before restoring', () => {
    const editor = document.createElement('div');
    editor.innerHTML = '<p>Old content</p>';

    const parts = [makeTextPart('t1', 'New content')];
    restoreUserMessageToEditor(editor, parts);

    expect(editor.textContent).toBe('New content');
    expect(editor.textContent).not.toContain('Old content');
  });

  it('handles empty parts gracefully', () => {
    const editor = document.createElement('div');
    editor.innerHTML = '<p>Existing</p>';

    restoreUserMessageToEditor(editor, []);

    // Should clear the editor but not add anything
    expect(editor.innerHTML).toBe('');
  });

  it('filters out synthetic parts from display text', () => {
    const editor = document.createElement('div');
    const parts = [
      makeTextPart('t1', 'User text'),
      {
        id: 't2',
        type: 'text',
        text: 'Backend continuation prompt',
        sessionID: 'test-session',
        messageID: 'test-msg',
        synthetic: true,
      } as unknown as Part,
    ];

    restoreUserMessageToEditor(editor, parts);

    // Only the non-synthetic display text should be included
    expect(editor.textContent).toBe('User text');
  });

  it('restores code-selection chip from file part with source', () => {
    const editor = document.createElement('div');
    const parts = [
      makeTextPart('t1', 'Explain [Code Selection: discovery.ts [21-24]]'),
      {
        id: 'f1',
        type: 'file',
        filename: 'discovery.ts [21-24]',
        mime: 'text/plain',
        url: 'file:///discovery.ts',
        sessionID: 'test-session',
        messageID: 'test-msg',
        source: {
          type: 'file',
          path: '/workspace/discovery.ts',
          text: { value: 'const x = 1;', start: 21, end: 24 },
        },
      } as unknown as Part,
    ];

    restoreUserMessageToEditor(editor, parts);

    const chips = editor.querySelectorAll('.opencode-chip');
    expect(chips).toHaveLength(1);
    expect(chips[0].getAttribute('data-chip-type')).toBe('code-selection');
    expect(chips[0].getAttribute('data-chip-filename')).toBe('discovery.ts [21-24]');
    expect(chips[0].getAttribute('data-chip-start-line')).toBe('21');
    expect(chips[0].getAttribute('data-chip-end-line')).toBe('24');
  });

  it('restores terminal chip from file part with terminal filename', () => {
    const editor = document.createElement('div');
    const parts = [
      makeTextPart('t1', 'Check [Terminal: 5 lines] output'),
      {
        id: 'f1',
        type: 'file',
        filename: 'terminal [5 lines]',
        mime: 'text/plain',
        url: 'data:text/plain;base64,dGVzdA==',
        sessionID: 'test-session',
        messageID: 'test-msg',
        source: {
          type: 'file',
          path: 'terminal-t1',
          text: { value: 'test output', start: 1, end: 5 },
        },
      } as unknown as Part,
    ];

    restoreUserMessageToEditor(editor, parts);

    const chips = editor.querySelectorAll('.opencode-chip');
    expect(chips).toHaveLength(1);
    expect(chips[0].getAttribute('data-chip-type')).toBe('terminal');
    expect(chips[0].getAttribute('data-chip-lines-count')).toBe('5');
  });

  it('restores pasted-text chip from text part with metadata', () => {
    const editor = document.createElement('div');
    const parts = [
      makeTextPart('t1', 'Review [Text: Pasted 3 Lines] code'),
      {
        id: 't2',
        type: 'text',
        text: 'line1\nline2\nline3',
        sessionID: 'test-session',
        messageID: 'test-msg',
        metadata: { type: 'pasted-text', linesCount: 3, filename: 'Pasted 3 Lines' },
      } as unknown as Part,
    ];

    restoreUserMessageToEditor(editor, parts);

    const chips = editor.querySelectorAll('.opencode-chip');
    expect(chips).toHaveLength(1);
    expect(chips[0].getAttribute('data-chip-type')).toBe('text');
    expect(chips[0].getAttribute('data-chip-filename')).toBe('Pasted 3 Lines');
    expect(chips[0].getAttribute('data-chip-lines-count')).toBe('3');
  });
});
