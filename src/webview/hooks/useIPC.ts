/**
 * @file Hook providing IPC send capability and optional incoming message handling.
 * Uses a ref-based handler to avoid stale closure issues.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { ExtToWebview, WebviewToExt } from '../../shared/types';

type MessageHandler = (message: ExtToWebview) => void;

/** Provides a `send` function for posting messages to the extension host. */
export function useIPC(onMessage: MessageHandler) {
  // Keep a ref to the latest handler to avoid stale closures in the event listener
  const handlerRef = useRef(onMessage);
  useEffect(() => {
    handlerRef.current = onMessage;
  });

  // Listen for incoming messages from the extension host
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data as ExtToWebview;
      handlerRef.current(message);
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  /** Posts a typed message to the VS Code extension host. */
  const send = useCallback((message: WebviewToExt) => {
    window.vscode.postMessage(message);
  }, []);

  return { send };
}
