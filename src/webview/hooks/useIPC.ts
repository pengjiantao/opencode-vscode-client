import { useCallback, useEffect, useRef } from 'react';
import type { ExtToWebview, WebviewToExt } from '../../shared/types';

type MessageHandler = (message: ExtToWebview) => void;

export function useIPC(onMessage: MessageHandler) {
  const handlerRef = useRef(onMessage);
  useEffect(() => {
    handlerRef.current = onMessage;
  });

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data as ExtToWebview;
      handlerRef.current(message);
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const send = useCallback((message: WebviewToExt) => {
    window.vscode.postMessage(message);
  }, []);

  return { send };
}
