import type { Message, Part, Session } from '@opencode-ai/sdk';
import { createOpencodeClient, createOpencodeServer } from '@opencode-ai/sdk';
import type { SDKClient, ServerHandle } from './sdk-client';

export function createSDKClient(directory?: string): SDKClient {
  let serverHandle: ServerHandle | null = null;
  let client = createOpencodeClient({ directory });

  const startServer = async (): Promise<ServerHandle> => {
    try {
      const testUrl = 'http://127.0.0.1:4096';
      const response = await fetch(testUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(1000),
      }).catch(() => null);
      if (response?.ok) {
        client = createOpencodeClient({ baseUrl: testUrl, directory });
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
    client = createOpencodeClient({ baseUrl: server.url, directory });
    return serverHandle;
  };

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
      messagesWithParts: async (id: string): Promise<Array<{ info: Message; parts: Part[] }>> => {
        const result = await client.session.messages({ path: { id } });
        return result.data ?? [];
      },
      prompt: async (id: string, parts: Part[], model?: string, agent?: string) => {
        const body: {
          parts: Part[];
          model?: { providerID: string; modelID: string };
          agent?: string;
        } = { parts };
        if (model) {
          const [providerID, modelID] = model.split('/');
          body.model = { providerID, modelID };
        }
        if (agent) {
          body.agent = agent;
        }
        await client.session.prompt({ path: { id }, body: body as never });
      },
      promptAsync: async (id: string, parts: Part[], model?: string, agent?: string) => {
        const body: {
          parts: Part[];
          model?: { providerID: string; modelID: string };
          agent?: string;
        } = { parts };
        if (model) {
          const [providerID, modelID] = model.split('/');
          body.model = { providerID, modelID };
        }
        if (agent) {
          body.agent = agent;
        }
        await client.session.promptAsync({ path: { id }, body: body as never });
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
    getModels: async (): Promise<Array<{ id: string; name: string }>> => {
      const result = await client.provider.list();
      const providers = result.data?.all ?? [];
      const modelsList: Array<{ id: string; name: string }> = [];
      for (const p of providers) {
        for (const mId of Object.keys(p.models || {})) {
          const model = p.models[mId];
          modelsList.push({
            id: `${p.id}/${model.id}`,
            name: `${p.name} - ${model.name || model.id}`,
          });
        }
      }
      return modelsList;
    },
    getAgents: async (): Promise<Array<{ id: string; name: string }>> => {
      const result = await client.app.agents();
      const agents = result.data ?? [];
      return agents.map((a) => ({
        id: a.name,
        name: a.name,
      }));
    },
  };
}
