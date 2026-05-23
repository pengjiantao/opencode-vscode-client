/**
 * @file Unit tests for extension command helpers.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'vscode';
import { pasteClipboardTextAsPlainText } from './commands';
import type { IPCBridge } from './ipc';

describe('extension command helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('regression: sends clipboard text to the prompt editor as plain text', async () => {
    const readText = vi.fn().mockResolvedValue('plain clipboard text');
    Object.defineProperty(env.clipboard, 'readText', {
      configurable: true,
      value: readText,
    });
    const send = vi.fn();
    const ipc = {
      send,
    } as unknown as IPCBridge;

    await pasteClipboardTextAsPlainText(ipc);

    expect(readText).toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith({
      type: 'editor:paste-plain-text',
      text: 'plain clipboard text',
    });
  });
});
