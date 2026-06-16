/**
 * @file Persistent prompt input history store.
 *
 * Mirrors the opencode TUI's `prompt-history.jsonl` semantics on top of
 * VS Code's `Memento` (JSON-serializable, atomic per-key writes):
 *  - Append-on-submit and append-on-clear-with-long-draft.
 *  - Dedupe back-to-back identical entries (TUI uses `JSON.stringify` equality).
 *  - Cap at `opencode.historySize` (default 50, clamped to `[1, 500]`).
 *  - Cross-workspace, cross-session (stored in `context.globalState`).
 */

import type { Memento } from 'vscode';
import { DEFAULT_HISTORY_SIZE, DRAFT_RETENTION_MIN_CHARS } from '../shared/promptHistory';
import type { Part, PromptHistoryEntry } from '../shared/types';
import { getConfiguration } from './utils/config';

/** Key used inside the globalState Memento to persist the history list. */
const STORAGE_KEY = 'promptHistory';

export { DRAFT_RETENTION_MIN_CHARS };

/**
 * Returns the effective history cap, sourced from the live extension configuration.
 * Read on every call so that user edits to `opencode.historySize` take effect
 * without requiring an extension reload.
 */
function resolveCap(): number {
  const raw = getConfiguration().historySize;
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_HISTORY_SIZE;
}

/**
 * Deep-equality check used for consecutive-entry dedupe. Matches the TUI's
 * `isDuplicateEntry` helper (which also uses `JSON.stringify`).
 *
 * @param previous The most recent stored entry, if any.
 * @param next The candidate entry to append.
 * @returns True when the two entries serialize to identical JSON.
 */
export function isDuplicateEntry(
  previous: PromptHistoryEntry | undefined,
  next: PromptHistoryEntry,
): boolean {
  if (!previous) return false;
  try {
    return JSON.stringify(previous) === JSON.stringify(next);
  } catch {
    return false;
  }
}

/**
 * Decides whether a user-cleared draft is worth retaining in history.
 * Mirrors the TUI's `clearPrompt` policy (>=20 chars or any parts).
 */
export function shouldRetainClearedDraft(input: string, parts: readonly Part[]): boolean {
  return input.trim().length >= DRAFT_RETENTION_MIN_CHARS || parts.length > 0;
}

/**
 * Persistent, append-only-with-cap storage for prompt input history.
 *
 * All public methods are synchronous; persistence is asynchronous via the
 * underlying `Memento.update` but callers don't need to await it.
 */
export class PromptHistoryStore {
  private readonly globalState: Memento;

  /** @param globalState The VS Code global state Memento (cross-workspace). */
  constructor(globalState: Memento) {
    this.globalState = globalState;
  }

  /**
   * Returns the current history list, newest entry last.
   * Defensive copy: callers may mutate the result freely.
   */
  list(): PromptHistoryEntry[] {
    const stored = this.globalState.get<PromptHistoryEntry[]>(STORAGE_KEY) ?? [];
    return stored.slice();
  }

  /**
   * Appends an entry, deduplicating back-to-back identical submissions and
   * trimming the oldest entries when the configured cap is exceeded.
   *
   * Returns a thenable resolving to `true` when the entry was persisted and
   * `false` when it was a back-to-back duplicate and no write happened. The
   * boolean lets callers (e.g. the `prompt:send` handler) decide whether to
   * echo a follow-up IPC to the webview without resorting to reference
   * comparisons across Memento re-reads.
   *
   * Memento write failures are surfaced only via the thenable's rejection
   * (callers are expected to fire-and-forget).
   */
  append(entry: PromptHistoryEntry): Thenable<boolean> {
    const current = this.list();
    if (isDuplicateEntry(current.at(-1), entry)) {
      return Promise.resolve(false);
    }
    const cap = resolveCap();
    const next =
      current.length >= cap
        ? current.slice(current.length - cap + 1).concat(entry)
        : current.concat(entry);
    return this.globalState.update(STORAGE_KEY, next).then(() => true);
  }

  /**
   * Removes every stored entry. Exposed for tests and for future "clear history"
   * UX; not currently called from the webview.
   */
  clear(): Thenable<void> {
    return this.globalState.update(STORAGE_KEY, undefined);
  }

  /**
   * Indicates whether a user-cleared draft of the given shape should be appended
   * to history. Thin pass-through to {@link shouldRetainClearedDraft} so callers
   * (e.g. the webview's clear handler) don't need to import the constant.
   */
  shouldRetainClearedDraft(input: string, parts: readonly Part[]): boolean {
    return shouldRetainClearedDraft(input, parts);
  }
}
