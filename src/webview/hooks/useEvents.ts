import { useEffect } from 'react';
import type { ExtToWebview } from '../../shared/types';
import { useIPC } from './useIPC';
import { useSession } from './useSession';

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
