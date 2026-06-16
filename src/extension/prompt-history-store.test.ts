/**
 * @file Unit tests for PromptHistoryStore.
 *
 * Covers TUI parity:
 *  - append preserves order and persists via Memento
 *  - cap is enforced at the configured size (default and custom)
 *  - back-to-back identical entries are deduplicated
 *  - non-consecutive duplicates are preserved
 *  - cleared-draft retention policy matches the TUI's 20-char threshold
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Memento } from 'vscode';
import type { Part, PromptHistoryEntry } from '../shared/types';
import {
  DRAFT_RETENTION_MIN_CHARS,
  isDuplicateEntry,
  PromptHistoryStore,
  shouldRetainClearedDraft,
} from './prompt-history-store';
import { getConfiguration } from './utils/config';

vi.mock('./utils/config', () => ({
  getConfiguration: vi.fn(),
}));

const textPart = (text: string): Part =>
  ({
    type: 'text',
    id: `text-${text}`,
    sessionID: 'session',
    messageID: 'message',
    text,
  }) as unknown as Part;

const entry = (input: string, parts: Part[] = []): PromptHistoryEntry => ({
  input,
  parts,
  mode: 'normal',
});

describe('isDuplicateEntry', () => {
  it('returns false when there is no previous entry', () => {
    expect(isDuplicateEntry(undefined, entry('hello'))).toBe(false);
  });

  it('returns true for structurally identical entries', () => {
    const a = entry('hello', [textPart('x')]);
    const b = entry('hello', [textPart('x')]);
    expect(isDuplicateEntry(a, b)).toBe(true);
  });

  it('returns false when the input text differs', () => {
    expect(isDuplicateEntry(entry('hello'), entry('world'))).toBe(false);
  });

  it('returns false when the parts length differs', () => {
    expect(isDuplicateEntry(entry('a', [textPart('x')]), entry('a', []))).toBe(false);
  });
});

describe('shouldRetainClearedDraft', () => {
  it('returns false for short empty drafts', () => {
    expect(shouldRetainClearedDraft('', [])).toBe(false);
    expect(shouldRetainClearedDraft('   ', [])).toBe(false);
    expect(shouldRetainClearedDraft('short', [])).toBe(false);
  });

  it(`returns true when input length is at or above ${DRAFT_RETENTION_MIN_CHARS}`, () => {
    const long = 'a'.repeat(DRAFT_RETENTION_MIN_CHARS);
    expect(shouldRetainClearedDraft(long, [])).toBe(true);
  });

  it('returns true when any parts are present, regardless of input length', () => {
    expect(shouldRetainClearedDraft('', [textPart('x')])).toBe(true);
    expect(shouldRetainClearedDraft('hi', [textPart('x')])).toBe(true);
  });
});

describe('PromptHistoryStore', () => {
  let mockMementoStore: Record<string, unknown>;
  let mockMemento: Memento;

  beforeEach(() => {
    mockMementoStore = {};
    mockMemento = {
      get: vi.fn((key: string, defaultValue?: unknown) =>
        mockMementoStore[key] !== undefined ? mockMementoStore[key] : defaultValue,
      ),
      update: vi.fn((key: string, value: unknown) => {
        if (value === undefined) {
          delete mockMementoStore[key];
        } else {
          mockMementoStore[key] = value;
        }
        return Promise.resolve();
      }),
      keys: [],
    } as unknown as Memento;

    vi.mocked(getConfiguration).mockReturnValue({
      model: '',
      agent: '',
      historySize: 50,
    });
  });

  it('returns an empty list when nothing is stored', () => {
    const store = new PromptHistoryStore(mockMemento);
    expect(store.list()).toEqual([]);
  });

  it('appends entries in order', () => {
    const store = new PromptHistoryStore(mockMemento);
    void store.append(entry('first'));
    void store.append(entry('second'));
    void store.append(entry('third'));

    expect(store.list().map((e) => e.input)).toEqual(['first', 'second', 'third']);
  });

  it('persists the appended list into the Memento', () => {
    const store = new PromptHistoryStore(mockMemento);
    void store.append(entry('a'));
    void store.append(entry('b'));

    expect(mockMementoStore['promptHistory']).toEqual([entry('a'), entry('b')]);
  });

  it('dedupes back-to-back identical entries (TUI parity)', () => {
    const store = new PromptHistoryStore(mockMemento);
    void store.append(entry('hello', [textPart('x')]));
    void store.append(entry('hello', [textPart('x')]));

    expect(store.list()).toHaveLength(1);
  });

  it('append() resolves to true on a real write and false on a back-to-back duplicate', async () => {
    const store = new PromptHistoryStore(mockMemento);

    await expect(store.append(entry('first'))).resolves.toBe(true);
    await expect(store.append(entry('second'))).resolves.toBe(true);
    // The third entry is a back-to-back duplicate of the second — no write.
    await expect(store.append(entry('second'))).resolves.toBe(false);
  });

  it('keeps non-consecutive duplicates', () => {
    const store = new PromptHistoryStore(mockMemento);
    void store.append(entry('hello'));
    void store.append(entry('middle'));
    void store.append(entry('hello'));

    expect(store.list().map((e) => e.input)).toEqual(['hello', 'middle', 'hello']);
  });

  it('enforces the configured cap by dropping the oldest entries', () => {
    vi.mocked(getConfiguration).mockReturnValue({ model: '', agent: '', historySize: 3 });
    const store = new PromptHistoryStore(mockMemento);

    void store.append(entry('a'));
    void store.append(entry('b'));
    void store.append(entry('c'));
    void store.append(entry('d'));

    expect(store.list().map((e) => e.input)).toEqual(['b', 'c', 'd']);
  });

  it('falls back to the default cap when the configuration is invalid', () => {
    vi.mocked(getConfiguration).mockReturnValue({ model: '', agent: '', historySize: 0 });
    const store = new PromptHistoryStore(mockMemento);

    for (let i = 0; i < 51; i += 1) void store.append(entry(`e${i}`));

    expect(store.list()).toHaveLength(50);
  });

  it('clear() removes every stored entry', () => {
    const store = new PromptHistoryStore(mockMemento);
    void store.append(entry('a'));
    void store.append(entry('b'));
    void store.clear();

    expect(store.list()).toEqual([]);
    expect(mockMementoStore['promptHistory']).toBeUndefined();
  });

  it('list() returns a defensive copy', () => {
    const store = new PromptHistoryStore(mockMemento);
    void store.append(entry('a'));

    const snapshot = store.list();
    snapshot.push(entry('b'));

    expect(store.list()).toHaveLength(1);
  });
});
