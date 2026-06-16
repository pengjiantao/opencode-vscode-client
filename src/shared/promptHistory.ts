/**
 * @file Constants and types shared by both the extension host and the webview
 * for prompt input history (Up/Down recall).
 *
 * Mirrors the opencode TUI's `packages/tui/src/prompt/history.tsx`:
 *  - {@link DRAFT_RETENTION_MIN_CHARS} matches `clearPrompt`'s >= 20 policy.
 *  - The cap default matches `MAX_HISTORY_ENTRIES = 50` from the TUI.
 */

/** Minimum character count (after trim) for a cleared draft to be retained in history. */
export const DRAFT_RETENTION_MIN_CHARS = 20;

/** Default maximum number of retained prompt history entries (TUI parity). */
export const DEFAULT_HISTORY_SIZE = 50;
