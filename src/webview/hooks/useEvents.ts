import { useEffect } from 'react';
import type { ExtToWebview } from '../../shared/types';
import { useIPC } from './useIPC';
import { useSession } from './useSession';

export function useEvents() {
  const { handleEvent } = useSession();
  const { send } = useIPC(() => {});

  useEffect(() => {
    const handler = (message: ExtToWebview) => {
      if (message.type === 'event:received') {
        handleEvent(message.event);
      }
    };

    window.addEventListener('message', handler as unknown as EventListener);
    return () => window.removeEventListener('message', handler as unknown as EventListener);
  }, [handleEvent]);

  useEffect(() => {
    send({ type: 'init' });
  }, [send]);
}
