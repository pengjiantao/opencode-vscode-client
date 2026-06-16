/**
 * @file Unit tests for the prompt history webview store.
 *
 * Covers TUI parity for the cursor walk:
 *  - `previous()` walks back through entries and stops at the oldest
 *  - `next()` walks forward and yields the live draft at cursor === 0
 *  - `pushEntry` mirrors back-to-back dedupe and resets the cursor
 *  - `startNavigation` only snapshots once per session
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PromptHistoryEntry } from '../../shared/types';
import { resetPromptHistoryStoreForTests, usePromptHistoryStore } from './promptHistoryStore';

const entry = (input: string): PromptHistoryEntry => ({
  input,
  parts: [],
  mode: 'normal',
});

describe('usePromptHistoryStore', () => {
  beforeEach(() => {
    resetPromptHistoryStoreForTests();
  });

  afterEach(() => {
    resetPromptHistoryStoreForTests();
  });

  it('starts empty with the live-draft sentinel cursor', () => {
    const state = usePromptHistoryStore.getState();
    expect(state.entries).toEqual([]);
    expect(state.cursor).toBe(0);
    expect(state.draftSnapshot).toBeNull();
  });

  it('pushEntry appends and resets the cursor', () => {
    usePromptHistoryStore.getState().pushEntry(entry('a'));
    usePromptHistoryStore.getState().pushEntry(entry('b'));
    expect(usePromptHistoryStore.getState().entries.map((e) => e.input)).toEqual(['a', 'b']);
    expect(usePromptHistoryStore.getState().cursor).toBe(0);
  });

  it('pushEntry dedupes back-to-back identical entries (TUI parity)', () => {
    const a: PromptHistoryEntry = { input: 'hello', parts: [], mode: 'normal' };
    usePromptHistoryStore.getState().pushEntry(a);
    usePromptHistoryStore.getState().pushEntry(a);
    expect(usePromptHistoryStore.getState().entries).toHaveLength(1);
  });

  it('previous() returns null when history is empty', () => {
    expect(usePromptHistoryStore.getState().previous()).toBeNull();
  });

  it('previous() walks backward one entry at a time', () => {
    usePromptHistoryStore.setState({
      entries: [entry('a'), entry('b'), entry('c')],
      cursor: 0,
      draftSnapshot: null,
    });

    expect(usePromptHistoryStore.getState().previous()?.input).toBe('c');
    expect(usePromptHistoryStore.getState().previous()?.input).toBe('b');
    expect(usePromptHistoryStore.getState().previous()?.input).toBe('a');
    expect(usePromptHistoryStore.getState().previous()).toBeNull();
  });

  it('next() returns null when the cursor is already at the live-draft sentinel', () => {
    usePromptHistoryStore.setState({
      entries: [entry('a')],
      cursor: 0,
      draftSnapshot: null,
    });
    expect(usePromptHistoryStore.getState().next()).toBeNull();
  });

  it('next() walks forward and yields the live draft when crossing the sentinel', () => {
    usePromptHistoryStore.setState({
      entries: [entry('a'), entry('b')],
      cursor: 0,
      draftSnapshot: 'in-progress draft',
    });
    usePromptHistoryStore.getState().previous();
    usePromptHistoryStore.getState().previous();

    const step1 = usePromptHistoryStore.getState().next();
    expect(step1).toEqual({ kind: 'entry', entry: entry('b') });

    const step2 = usePromptHistoryStore.getState().next();
    expect(step2).toEqual({ kind: 'draft', draft: 'in-progress draft' });
    expect(usePromptHistoryStore.getState().cursor).toBe(0);
    expect(usePromptHistoryStore.getState().draftSnapshot).toBeNull();
  });

  it('startNavigation overwrites the draft snapshot when called at the live-draft sentinel', () => {
    // Repeated Up presses (without an intervening Down that crossed back to
    // the live draft) should each capture the freshest draft text. The
    // mid-navigation case (cursor !== 0) is covered by the next test.
    usePromptHistoryStore.getState().startNavigation('first');
    usePromptHistoryStore.getState().startNavigation('second');
    expect(usePromptHistoryStore.getState().draftSnapshot).toBe('second');
  });

  it('startNavigation is a no-op once a navigation session is in progress', () => {
    usePromptHistoryStore.setState({
      entries: [entry('a')],
      cursor: 0,
      draftSnapshot: null,
    });
    usePromptHistoryStore.getState().startNavigation('live');
    usePromptHistoryStore.getState().previous();
    expect(usePromptHistoryStore.getState().cursor).toBe(-1);
    usePromptHistoryStore.getState().startNavigation('should-be-ignored');
    expect(usePromptHistoryStore.getState().draftSnapshot).toBe('live');
  });

  it('resetCursor clears the navigation state', () => {
    usePromptHistoryStore.setState({
      entries: [entry('a')],
      cursor: -1,
      draftSnapshot: 'draft',
    });
    usePromptHistoryStore.getState().resetCursor();
    expect(usePromptHistoryStore.getState().cursor).toBe(0);
    expect(usePromptHistoryStore.getState().draftSnapshot).toBeNull();
  });

  it('setEntries replaces the mirror wholesale', () => {
    usePromptHistoryStore.getState().pushEntry(entry('stale'));
    usePromptHistoryStore.getState().setEntries([entry('a'), entry('b')]);
    expect(usePromptHistoryStore.getState().entries.map((e) => e.input)).toEqual(['a', 'b']);
  });
});
