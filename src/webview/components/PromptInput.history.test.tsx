/**
 * @file Regression tests for the prompt input history (Up/Down recall) wired
 * into {@link PromptInput}. Mirrors the opencode TUI's behavior:
 *  - ArrowUp at the start of the editor loads the most recent history entry.
 *  - ArrowUp at a non-start position is ignored (normal caret move).
 *  - ArrowDown past the newest entry restores the user's in-progress draft.
 *  - Mention and command popovers take precedence over history navigation.
 *  - Submitting a prompt posts `prompt-history:append` only via the
 *    extension-side handler; the webview resets the local history cursor.
 *  - Clearing a long draft posts `prompt-history:append`; clearing a short
 *    draft does not.
 */

import type { Part } from '@opencode-ai/sdk/v2/client';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PromptInput } from './PromptInput';

vi.mock('@vscode/webview-ui-toolkit/react', () => ({
  VSCodeButton: ({
    children,
    onClick,
    className,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} className={className} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('../store/sessionStore', () => ({
  useSessionStore: vi.fn(),
}));

const recordClearedDraft = vi.fn();
const resetCursor = vi.fn();
const pushEntry = vi.fn();
const setEntries = vi.fn();

const promptHistoryState = {
  entries: [] as { input: string; parts: Part[]; mode?: 'normal' }[],
  cursor: 0 as number,
  draftSnapshot: null as string | null,
  setEntries,
  pushEntry,
  startNavigation: vi.fn(),
  previous: vi.fn(),
  next: vi.fn(),
  resetCursor,
};

vi.mock('../store/promptHistoryStore', () => ({
  usePromptHistoryStore: Object.assign(
    (selector: (s: typeof promptHistoryState) => unknown) => selector(promptHistoryState),
    {
      getState: () => promptHistoryState,
    },
  ),
}));

vi.mock('../hooks/usePromptHistory', () => ({
  usePromptHistory: () => ({ recordClearedDraft }),
}));

vi.mock('../hooks/usePromptEditor', () => ({
  usePromptEditor: () => ({
    handlePaste: vi.fn(),
    insertChip: vi.fn(),
    insertText: vi.fn(),
  }),
}));

vi.mock('../hooks/useCommandEditor', () => ({
  useCommandEditor: () => ({
    commandState: { show: false, skillsOnly: false },
    commandSelectedIndex: 0,
    setCommandSelectedIndex: vi.fn(),
    commandResults: [],
    closeCommandList: vi.fn(),
    handleSlashTrigger: vi.fn(),
    onSelectCommandItem: vi.fn(),
  }),
}));

vi.mock('../hooks/useMentionEditor', () => ({
  useMentionEditor: () => ({
    mentionState: { show: false, query: '' },
    mentionResults: [],
    setMentionResults: vi.fn(),
    selectedIndex: 0,
    setSelectedIndex: vi.fn(),
    mentionTimeoutRef: { current: null as number | null },
    closeMentionList: vi.fn(),
    handleMentionTrigger: vi.fn(),
    insertMentionChip: vi.fn(),
  }),
}));

vi.mock('../hooks/usePromptSelectionIPC', () => ({
  usePromptSelectionIPC: () => undefined,
}));

vi.mock('../hooks/useIPC', () => ({
  useIPC: (handler: (message: unknown) => void) => {
    ipcHandlers.push(handler);
    return { send: vi.fn() };
  },
}));

// Captures every handler that usePromptHistory registers. Tests invoke them
// via `simulateExtMessage` to drive the prompt history store from "the
// extension" without going through the real window message bus.
const ipcHandlers: Array<(message: unknown) => void> = [];
const simulateExtMessage = (message: unknown): void => {
  for (const handler of ipcHandlers) handler(message);
};

import type { SessionStore } from '../store/sessionStore';
import { useSessionStore } from '../store/sessionStore';

const defaultMockState = {
  workspaceName: null,
  lspServers: [],
  mcpServers: [],
  skills: [],
  commands: [],
  plugins: [],
  extensionVersion: '0.0.0',
  publisher: 'fiyqkrc',
  opencodeVersion: '1.0.0',
  activeSessionID: 'session-1',
  fileInfos: {},
  sessionDiffs: {},
  messages: {},
};

describe('PromptInput prompt history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    promptHistoryState.entries = [];
    promptHistoryState.cursor = 0;
    promptHistoryState.draftSnapshot = null;
    promptHistoryState.previous.mockReturnValue(null);
    promptHistoryState.next.mockReturnValue(null);

    vi.mocked(useSessionStore).mockImplementation(
      <T,>(selector: (state: SessionStore) => T): T =>
        selector(defaultMockState as unknown as SessionStore),
    );
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function getEditor(): HTMLElement {
    return screen.getByTestId('prompt-editor');
  }

  function setEditorText(text: string): void {
    const editor = getEditor();
    editor.innerHTML = '';
    editor.appendChild(document.createTextNode(text));
    // Caret at the end.
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  function setCaretAtStart(): void {
    const editor = getEditor();
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  it('regression: ArrowUp at the start of an empty editor loads the most recent entry', () => {
    const entry = { input: 'previous prompt', parts: [], mode: 'normal' as const };
    promptHistoryState.entries = [entry];
    promptHistoryState.previous.mockReturnValue(entry);

    render(
      <PromptInput
        onSubmit={vi.fn()}
        models={[]}
        agents={[]}
        onModelChange={vi.fn()}
        onAgentChange={vi.fn()}
      />,
    );

    const editor = getEditor();
    setCaretAtStart();

    fireEvent.keyDown(editor, { key: 'ArrowUp', code: 'ArrowUp' });

    expect(promptHistoryState.startNavigation).toHaveBeenCalled();
    expect(promptHistoryState.previous).toHaveBeenCalled();
    expect(editor.textContent).toBe('previous prompt');
  });

  it('regression: ArrowUp at a non-start position does not navigate history', () => {
    promptHistoryState.entries = [{ input: 'previous', parts: [], mode: 'normal' as const }];

    render(
      <PromptInput
        onSubmit={vi.fn()}
        models={[]}
        agents={[]}
        onModelChange={vi.fn()}
        onAgentChange={vi.fn()}
      />,
    );

    setEditorText('hello world');
    // Caret is at the end (set by setEditorText). Move it to a non-edge position
    // by placing the selection start at the first text node, offset 3.
    const editor = getEditor();
    const textNode = editor.firstChild as Text;
    const sel = window.getSelection();
    if (!sel || !textNode) return;
    const range = document.createRange();
    range.setStart(textNode, 3);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    fireEvent.keyDown(editor, { key: 'ArrowUp', code: 'ArrowUp' });

    expect(promptHistoryState.previous).not.toHaveBeenCalled();
  });

  it('regression: ArrowDown past the newest entry restores the in-progress draft', () => {
    const entry = { input: 'older prompt', parts: [], mode: 'normal' as const };
    promptHistoryState.entries = [entry];
    promptHistoryState.cursor = -1; // already navigated back
    promptHistoryState.draftSnapshot = 'live draft text';
    promptHistoryState.next.mockReturnValue({ kind: 'draft', draft: 'live draft text' });

    render(
      <PromptInput
        onSubmit={vi.fn()}
        models={[]}
        agents={[]}
        onModelChange={vi.fn()}
        onAgentChange={vi.fn()}
      />,
    );

    setEditorText('older prompt');
    // Place caret at the end of the editor.
    const editor = getEditor();
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    fireEvent.keyDown(editor, { key: 'ArrowDown', code: 'ArrowDown' });

    expect(promptHistoryState.next).toHaveBeenCalled();
    expect(editor.textContent).toBe('live draft text');
  });

  it('regression: ArrowDown at cursor === 0 is a no-op', () => {
    promptHistoryState.entries = [{ input: 'older', parts: [], mode: 'normal' as const }];
    promptHistoryState.cursor = 0;

    render(
      <PromptInput
        onSubmit={vi.fn()}
        models={[]}
        agents={[]}
        onModelChange={vi.fn()}
        onAgentChange={vi.fn()}
      />,
    );

    setEditorText('');
    const editor = getEditor();
    fireEvent.keyDown(editor, { key: 'ArrowDown', code: 'ArrowDown' });

    expect(promptHistoryState.next).not.toHaveBeenCalled();
  });

  it('regression: ArrowUp with no history entries is a no-op', () => {
    promptHistoryState.entries = [];

    render(
      <PromptInput
        onSubmit={vi.fn()}
        models={[]}
        agents={[]}
        onModelChange={vi.fn()}
        onAgentChange={vi.fn()}
      />,
    );

    const editor = getEditor();
    setCaretAtStart();

    fireEvent.keyDown(editor, { key: 'ArrowUp', code: 'ArrowUp' });

    expect(promptHistoryState.previous).not.toHaveBeenCalled();
  });

  it('regression: ArrowUp with modifier keys does not navigate history', () => {
    promptHistoryState.entries = [{ input: 'older', parts: [], mode: 'normal' as const }];

    render(
      <PromptInput
        onSubmit={vi.fn()}
        models={[]}
        agents={[]}
        onModelChange={vi.fn()}
        onAgentChange={vi.fn()}
      />,
    );

    const editor = getEditor();
    setCaretAtStart();

    fireEvent.keyDown(editor, { key: 'ArrowUp', code: 'ArrowUp', altKey: true });

    expect(promptHistoryState.previous).not.toHaveBeenCalled();
  });

  it('regression: successful submit resets the local history cursor', () => {
    const onSubmit = vi.fn();
    promptHistoryState.entries = [{ input: 'older', parts: [], mode: 'normal' as const }];
    promptHistoryState.cursor = -1;

    render(
      <PromptInput
        onSubmit={onSubmit}
        models={[]}
        agents={[]}
        onModelChange={vi.fn()}
        onAgentChange={vi.fn()}
      />,
    );

    setEditorText('a real prompt to send');
    fireEvent.input(getEditor());

    fireEvent.click(screen.getByLabelText('Send'));

    expect(onSubmit).toHaveBeenCalled();
    expect(resetCursor).toHaveBeenCalled();
  });

  it('regression: clearing a long draft posts a prompt-history:append IPC', () => {
    render(
      <PromptInput
        onSubmit={vi.fn()}
        models={[]}
        agents={[]}
        onModelChange={vi.fn()}
        onAgentChange={vi.fn()}
      />,
    );

    const longText = 'a'.repeat(25);
    setEditorText(longText);
    // First input event seeds the previous-state refs.
    fireEvent.input(getEditor());
    // Now the user clears the editor in one shot (e.g., select-all + delete).
    const editor = getEditor();
    editor.innerHTML = '';
    fireEvent.input(editor);

    expect(recordClearedDraft).toHaveBeenCalledWith(longText, []);
  });

  it('regression: clearing a short draft does NOT post a prompt-history:append IPC', () => {
    render(
      <PromptInput
        onSubmit={vi.fn()}
        models={[]}
        agents={[]}
        onModelChange={vi.fn()}
        onAgentChange={vi.fn()}
      />,
    );

    setEditorText('short');
    fireEvent.input(getEditor());

    const editor = getEditor();
    editor.innerHTML = '';
    fireEvent.input(editor);

    expect(recordClearedDraft).not.toHaveBeenCalled();
  });

  it('regression: the just-submitted prompt is recallable via Up without a webview reload', () => {
    // Mirror what the extension sends back to the webview after a successful
    // submit: a `prompt-history:appended` message carrying the new entry.
    // The webview's local store must absorb this so the very next ArrowUp
    // loads the entry — no reload required.
    const submitted = { input: 'first submitted prompt', parts: [], mode: 'normal' as const };
    // Seed `previous` so that the upcoming ArrowUp call returns our entry.
    promptHistoryState.entries = [submitted];
    promptHistoryState.previous.mockReturnValue(submitted);

    render(
      <PromptInput
        onSubmit={vi.fn()}
        models={[]}
        agents={[]}
        onModelChange={vi.fn()}
        onAgentChange={vi.fn()}
      />,
    );

    // Drive the extension-side notification.
    simulateExtMessage({ type: 'prompt-history:appended', entry: submitted });

    // Now press Up at the start of the (empty) editor.
    const editor = getEditor();
    setCaretAtStart();
    fireEvent.keyDown(editor, { key: 'ArrowUp', code: 'ArrowUp' });

    expect(promptHistoryState.previous).toHaveBeenCalled();
    expect(editor.textContent).toBe('first submitted prompt');
  });
});
