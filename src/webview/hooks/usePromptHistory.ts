/**
 * @file Hook that wires the webview's prompt history store to the extension host.
 *
 * Responsibilities:
 *  - On mount, ask the extension for the persisted list and seed the store.
 *  - Expose a small `recordClearedDraft` helper for the clear-when-long policy.
 *
 * Navigation (`previous` / `next` / `reset`) is intentionally NOT done through
 * this hook — it lives directly in the keydown handler in `PromptInput`, which
 * already owns the editor ref. This hook is the persistence bridge only.
 */

import { useEffect, useRef } from 'react';
import { DRAFT_RETENTION_MIN_CHARS } from '../../shared/promptHistory';
import type { Part, PromptHistoryEntry } from '../../shared/types';
import { usePromptHistoryStore } from '../store/promptHistoryStore';
import { useIPC } from './useIPC';

export interface UsePromptHistoryResult {
  /**
   * Posts a `prompt-history:append` IPC for a draft that the user just cleared.
   * No-op when the cleared text is shorter than {@link DRAFT_RETENTION_MIN_CHARS}
   * and has no parts, mirroring the opencode TUI's `clearPrompt` policy.
   */
  recordClearedDraft: (input: string, parts: Part[]) => void;
}

/**
 * Wires the prompt history webview store to the extension host.
 *
 * @returns A small object exposing the cleared-draft bridge.
 */
export function usePromptHistory(): UsePromptHistoryResult {
  const setEntries = usePromptHistoryStore((s) => s.setEntries);
  const requestedRef = useRef(false);

  useIPC((message) => {
    if (message.type === 'prompt-history:list') {
      setEntries(message.entries);
      return;
    }
    if (message.type === 'prompt-history:appended') {
      // Mirror the extension's authoritative write into the local store so the
      // just-submitted entry is recallable via Up/Down without a webview reload.
      usePromptHistoryStore.getState().pushEntry(message.entry);
    }
  });

  useEffect(() => {
    // Fetch exactly once per mount. The extension's Memento is the source of
    // truth, so we only need a single pull; subsequent appends are optimistic
    // and the persisted list will resync if a new mount occurs.
    if (requestedRef.current) return;
    requestedRef.current = true;
    window.vscode.postMessage({ type: 'prompt-history:list' });
  }, []);

  const recordClearedDraft = (input: string, parts: Part[]): void => {
    if (input.trim().length < DRAFT_RETENTION_MIN_CHARS && parts.length === 0) return;
    const entry: PromptHistoryEntry = { input, parts, mode: 'normal' };
    // Push locally for instant UI consistency; the extension is also the
    // authoritative store and has its own dedupe pass.
    usePromptHistoryStore.getState().pushEntry(entry);
    window.vscode.postMessage({ type: 'prompt-history:append', entry });
  };

  return { recordClearedDraft };
}
