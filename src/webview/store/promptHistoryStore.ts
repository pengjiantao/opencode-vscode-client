/**
 * @file Zustand store for the prompt input history (Up/Down recall).
 *
 * Holds a mirrored copy of the extension's persistent history plus a small
 * cursor state for navigation. The extension is the source of truth — the
 * webview only mirrors it for fast Up/Down navigation and posts back
 * `prompt-history:append` messages when a long draft is cleared.
 *
 * The cursor model mirrors the opencode TUI (`packages/tui/src/prompt/history.tsx`):
 *  - `cursor = 0` is the "live draft" sentinel (newest + 1, no entry displayed).
 *  - `cursor = -N` walks back into the entry list (1-indexed from the end).
 *  - Navigating past `0` yields `null` and clears `draftSnapshot`, telling the
 *    caller to restore the user's in-progress draft.
 */

import { create } from 'zustand';
import type { PromptHistoryEntry } from '../../shared/types';

/** Full shape of the prompt history store's state and actions. */
export interface PromptHistoryStore {
  /** Mirror of the extension's persistent history. Newest entry is at the end. */
  entries: PromptHistoryEntry[];

  /**
   * Current navigation cursor. `0` = live draft sentinel. `-1` = last entry,
   * `-2` = second-to-last, etc. Undefined means navigation hasn't started.
   */
  cursor: number;

  /**
   * Snapshot of the user's in-progress text captured when they first pressed Up
   * on an unmodified editor. Used to restore the live draft when they walk
   * past the newest entry with Down.
   */
  draftSnapshot: string | null;

  /** Replace the entire mirror with the latest snapshot from the extension. */
  setEntries: (entries: PromptHistoryEntry[]) => void;

  /**
   * Append a new entry to the mirror (fire-and-forget; persistence happens
   * extension-side on submit). Resets the navigation cursor.
   */
  pushEntry: (entry: PromptHistoryEntry) => void;

  /**
   * Begin a navigation session by snapshotting the user's current draft.
   * No-op if a session is already in progress (cursor !== 0).
   */
  startNavigation: (currentDraft: string) => void;

  /**
   * Walk one step backward in history. Returns the entry to display, or `null`
   * when already at the oldest entry. Caller should treat `null` as "no-op".
   */
  previous: () => PromptHistoryEntry | null;

  /**
   * Walk one step forward in history. Returns the entry to display, `null`
   * when the user is moving past the newest entry (caller should restore
   * `draftSnapshot` and clear it).
   */
  next: () =>
    | { kind: 'entry'; entry: PromptHistoryEntry }
    | { kind: 'draft'; draft: string }
    | null;

  /** Drop any active navigation session (called after a successful submit). */
  resetCursor: () => void;
}

const initialState = {
  entries: [] as PromptHistoryEntry[],
  cursor: 0 as number,
  draftSnapshot: null as string | null,
};

export const usePromptHistoryStore = create<PromptHistoryStore>((set, get) => ({
  ...initialState,

  setEntries: (entries) => set({ entries }),

  pushEntry: (entry) => {
    set((state) => {
      // Mirror extension-side dedupe of back-to-back identical entries so the
      // webview UI stays consistent with the persisted list.
      const last = state.entries.at(-1);
      const isDuplicate = last !== undefined && JSON.stringify(last) === JSON.stringify(entry);
      if (isDuplicate) return {};
      return {
        entries: [...state.entries, entry],
        cursor: 0,
        draftSnapshot: null,
      };
    });
  },

  startNavigation: (currentDraft) => {
    if (get().cursor !== 0) return;
    set({ draftSnapshot: currentDraft });
  },

  previous: () => {
    const state = get();
    if (state.entries.length === 0) return null;
    const next = state.cursor - 1;
    if (-next > state.entries.length) {
      // Already at the oldest entry; keep cursor where it is.
      return null;
    }
    set({ cursor: next });
    return state.entries[state.entries.length + next] ?? null;
  },

  next: () => {
    const state = get();
    if (state.cursor === 0) return null;
    const next = state.cursor + 1;
    if (next === 0) {
      const draft = state.draftSnapshot ?? '';
      set({ cursor: 0, draftSnapshot: null });
      return { kind: 'draft', draft };
    }
    if (next > 0) {
      // Defensive: should be unreachable because of the cursor===0 guard above.
      return null;
    }
    set({ cursor: next });
    return { kind: 'entry', entry: state.entries[state.entries.length + next] ?? null };
  },

  resetCursor: () => set({ cursor: 0, draftSnapshot: null }),
}));

/** Test-only helper that resets the store to its empty initial state. */
export function resetPromptHistoryStoreForTests(): void {
  usePromptHistoryStore.setState((s) => ({ ...s, ...initialState }));
}
