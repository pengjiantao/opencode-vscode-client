/**
 * @file Custom React hook for handling editor and terminal selection IPC events from the extension host.
 * Decouples the selection processing and action dispatching logic from the main PromptInput UI component.
 */

import { useEffect, useRef } from 'react';
import { useIPC } from './useIPC';
import type { EditorChip } from './usePromptEditor';

/**
 * Interface representing the properties needed for the usePromptSelectionIPC hook.
 */
export interface UsePromptSelectionIPCProps {
  /** Callback to insert a new chip into the prompt editor */
  insertChip: (chip: EditorChip) => void;
  /** Callback to insert preset text at the current cursor selection */
  insertText: (text: string) => void;
  /** Callback to submit the active prompt message turn */
  onSubmit: () => void;
}

/**
 * Hook to subscribe to editor/terminal selection IPC events and execute associated insert/submit actions.
 *
 * @param props The configuration properties.
 */
export function usePromptSelectionIPC({
  insertChip,
  insertText,
  onSubmit,
}: UsePromptSelectionIPCProps) {
  // Use references to prevent stale closure captures within the IPC event listener
  const callbacksRef = useRef({ insertChip, insertText, onSubmit });
  useEffect(() => {
    callbacksRef.current = { insertChip, insertText, onSubmit };
  }, [insertChip, insertText, onSubmit]);

  useIPC((message) => {
    if (message.type === 'editor:selection') {
      const { text, filename, path, startLine, endLine, action } = message;

      callbacksRef.current.insertChip({
        id: `editor-selection-${Date.now()}`,
        type: 'code-selection',
        filename,
        path,
        text,
        startLine,
        endLine,
      });

      if (action === 'explain') {
        // Insert preset text at cursor and submit immediately
        callbacksRef.current.insertText('\nExplain this code');
        callbacksRef.current.onSubmit();
      }
    } else if (message.type === 'terminal:selection') {
      const { text, linesCount, action } = message;

      callbacksRef.current.insertChip({
        id: `terminal-selection-${Date.now()}`,
        type: 'terminal',
        filename: `terminal [${linesCount} lines]`,
        text,
        linesCount,
      });

      if (action === 'explain-fix') {
        // Insert preset text at cursor and submit immediately
        callbacksRef.current.insertText('\nExplain this content or fix issues in it');
        callbacksRef.current.onSubmit();
      }
    } else if (message.type === 'editor:paste-plain-text') {
      callbacksRef.current.insertText(message.text);
    }
  });
}
