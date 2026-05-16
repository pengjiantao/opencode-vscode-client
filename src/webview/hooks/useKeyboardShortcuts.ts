import { useCallback, useEffect, useRef } from 'react';
import { useSession } from './useSession';

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
}

export function useKeyboardShortcuts() {
  const { createSession, activeSessionID } = useSession();

  const shortcuts = useRef<KeyboardShortcut[]>([
    {
      key: 'Enter',
      action: () => {
        // Enter is handled by PromptInput
      },
    },
    {
      key: 'l',
      ctrlKey: true,
      action: () => {
        createSession();
      },
    },
    {
      key: 'Escape',
      action: () => {
        void activeSessionID;
      },
    },
    {
      key: '1',
      altKey: true,
      action: () => {
        // Switch to tab 1 (handled by SessionTabs)
      },
    },
    {
      key: '2',
      altKey: true,
      action: () => {
        // Switch to tab 2
      },
    },
  ]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    for (const shortcut of shortcuts.current) {
      const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatch = shortcut.ctrlKey ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey;
      const shiftMatch = shortcut.shiftKey ? e.shiftKey : !e.shiftKey;
      const altMatch = shortcut.altKey ? e.altKey : !e.altKey;

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        e.preventDefault();
        e.stopPropagation();
        shortcut.action();
        return;
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export const KEYBOARD_SHORTCUTS = [
  { key: 'Ctrl+Shift+L', description: 'Create new session' },
  { key: 'Escape', description: 'Abort current operation' },
  { key: 'Alt+1-9', description: 'Switch to session tab' },
  { key: 'Enter', description: 'Send message (in input)' },
  { key: 'Shift+Enter', description: 'New line (in input)' },
];
