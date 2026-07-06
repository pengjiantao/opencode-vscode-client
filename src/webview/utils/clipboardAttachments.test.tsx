/**
 * @file Unit tests for clipboard attachment paste planning utilities.
 */

import { describe, expect, it } from 'vitest';
import { ClipboardAttachmentUtils } from './clipboardAttachments';

class MockClipboardData {
  readonly files: File[];
  private readonly dataByFormat: Record<string, string>;

  constructor(textOrData: string | Record<string, string> = '', files: File[] = []) {
    this.files = files;
    this.dataByFormat = typeof textOrData === 'string' ? { 'text/plain': textOrData } : textOrData;
  }

  getData(format: string): string {
    return this.dataByFormat[format] ?? '';
  }
}

function clipboardData(
  textOrData: string | Record<string, string> = '',
  files: File[] = [],
): DataTransfer {
  return new MockClipboardData(textOrData, files) as unknown as DataTransfer;
}

describe('ClipboardAttachmentUtils', () => {
  it('regression: converts pasted PDFs with URI-list paths into Markdown references', () => {
    const file = new File(['%PDF-1.4'], 'statement.pdf', { type: 'application/pdf' });
    const plan = ClipboardAttachmentUtils.createPastePlan(
      clipboardData(
        {
          'text/plain': 'statement.pdf',
          'text/uri-list': 'file:///home/user/Documents/statement.pdf',
        },
        [file],
      ),
    );

    expect(plan).toEqual({
      handled: true,
      actions: [
        {
          type: 'markdown-reference',
          text: '[statement.pdf](</home/user/Documents/statement.pdf>)\n',
        },
      ],
    });
  });

  it('regression: treats pasted VSIX files as Markdown references even when reported as text', () => {
    const file = new File(['PK'], 'extension.vsix', { type: 'text/plain' });
    const plan = ClipboardAttachmentUtils.createPastePlan(
      clipboardData(
        {
          'text/plain': 'extension.vsix',
          'text/uri-list': 'file:///home/user/Downloads/extension.vsix',
        },
        [file],
      ),
    );

    expect(plan.actions).toEqual([
      {
        type: 'markdown-reference',
        text: '[extension.vsix](</home/user/Downloads/extension.vsix>)\n',
      },
    ]);
  });

  it('regression: requests host path resolution for document files without exposed paths', () => {
    const file = new File(['PK'], 'income-proof.docx', { type: 'text/plain' });
    const plan = ClipboardAttachmentUtils.createPastePlan(
      clipboardData('income-proof.docx', [file]),
    );

    expect(plan.actions).toEqual([
      {
        type: 'resolve-file-path',
        filename: 'income-proof.docx',
        size: file.size,
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
    ]);
  });

  it('regression: treats pasted extensionless binaries as Markdown references', () => {
    const file = new File(['\u007fELF'], 'opencode', { type: '' });
    const plan = ClipboardAttachmentUtils.createPastePlan(
      clipboardData(
        {
          'text/plain': 'opencode',
          'text/uri-list': 'file:///usr/local/bin/opencode',
        },
        [file],
      ),
    );

    expect(plan.actions).toEqual([
      {
        type: 'markdown-reference',
        text: '[opencode](</usr/local/bin/opencode>)\n',
      },
    ]);
  });

  it('creates file-chip actions for pasted text-readable file paths', () => {
    const plan = ClipboardAttachmentUtils.createPastePlan(
      clipboardData('/home/workspace/package.json'),
    );

    expect(plan.actions).toEqual([
      {
        type: 'file-chip',
        path: '/home/workspace/package.json',
        filename: 'package.json',
        mime: 'application/json',
      },
    ]);
  });

  it('creates text-chip actions for ordinary pasted text', () => {
    const plan = ClipboardAttachmentUtils.createPastePlan(clipboardData('first\nsecond'));

    expect(plan.actions).toEqual([
      {
        type: 'text-chip',
        filename: 'Pasted 2 Lines',
        text: 'first\nsecond',
        linesCount: 2,
      },
    ]);
  });
});
