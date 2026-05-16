import type { Message, Part, Session } from '@opencode-ai/sdk';
import { createOpencodeClient, createOpencodeServer } from '@opencode-ai/sdk';
import type { SDKClient, ServerHandle } from './sdk-client';

export function createSDKClient(): SDKClient {
  let serverHandle: ServerHandle | null = null;

  const startServer = async (): Promise<ServerHandle> => {
    try {
      const testUrl = 'http://127.0.0.1:4096';
      const response = await fetch(testUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(1000),
      }).catch(() => null);
      if (response?.ok) {
        return {
          url: testUrl,
          close: () => {},
        };
      }
    } catch {
      /* server not running */
    }

    const server = await createOpencodeServer();
    serverHandle = {
      url: server.url,
      close: () => server.close(),
    };
    return serverHandle;
  };

  const client = createOpencodeClient();

  return {
    startServer,
    session: {
      create: async (): Promise<Session> => {
        const result = await client.session.create();
        if (!result.data) throw new Error('Failed to create session');
        return result.data;
      },
      list: async (): Promise<Session[]> => {
        const result = await client.session.list();
        return result.data ?? [];
      },
      get: async (id: string): Promise<Session> => {
        const result = await client.session.get({ path: { id } });
        if (!result.data) throw new Error('Failed to get session');
        return result.data;
      },
      update: async (id: string, patch: Partial<Session>): Promise<Session> => {
        const result = await client.session.update({ path: { id }, body: patch });
        if (!result.data) throw new Error('Failed to update session');
        return result.data;
      },
      delete: async (id: string) => {
        await client.session.delete({ path: { id } });
      },
      messages: async (id: string): Promise<Message[]> => {
        const result = await client.session.messages({ path: { id } });
        return result.data?.map((m: { info: Message; parts: Part[] }) => m.info) ?? [];
      },
      prompt: async (id: string, parts: Part[]) => {
        await client.session.prompt({ path: { id }, body: { parts: parts as never } });
      },
      promptAsync: async (id: string, parts: Part[]) => {
        await client.session.promptAsync({ path: { id }, body: { parts: parts as never } });
      },
      abort: async (id: string) => {
        await client.session.abort({ path: { id } });
      },
    },
    subscribeEvents: (handler) => {
      let closed = false;

      const subscription = client.event.subscribe().then((sseResult) => {
        if (closed) return;

        void (async () => {
          try {
            for await (const event of sseResult.stream) {
              if (closed) break;
              handler(event);
            }
          } catch (err) {
            if (!closed) console.error('SSE stream error:', err);
          }
        })();

        return sseResult;
      });

      return () => {
        closed = true;
        void subscription.then((sseResult) => sseResult?.stream.return?.(undefined));
      };
    },
  };
}
