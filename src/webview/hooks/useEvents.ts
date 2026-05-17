/**
 * @file Hook that listens for SSE events from the extension host
 * and dispatches them to the session store via useSession.
 */

import { useEffect } from 'react';
import type { ExtToWebview } from '../../shared/types';
import { useIPC } from './useIPC';
import { useSession } from './useSession';

/** Subscribes to event:received IPC messages and sends an init request on mount. */
export function useEvents() {
  const { handleEvent } = useSession();
  const { send } = useIPC(() => {});

  useEffect(() => {
    const handler = (event: MessageEvent<ExtToWebview>) => {
      const message = event.data;
      if (message && message.type === 'event:received') {
        handleEvent(message.event);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [handleEvent]);

  useEffect(() => {
    send({ type: 'init' });
  }, [send]);
}
