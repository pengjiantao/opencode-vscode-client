/**
 * @file Concrete implementation of the SDKClient interface.
 * Manages server lifecycle (auto-connect to existing server or start new one)
 * and wraps the @opencode-ai/sdk library operations.
 */

import { createOpencodeServer } from '@opencode-ai/sdk';
import type {
  AgentPartInput,
  Config,
  FilePartInput,
  LspStatus,
  McpStatus,
  Message,
  Part,
  Session,
  SubtaskPartInput,
  TextPartInput,
} from '@opencode-ai/sdk/v2/client';
import { createOpencodeClient } from '@opencode-ai/sdk/v2/client';
import type { SDKClient, ServerHandle } from './sdk-client';

/** Creates a configured SDK client, attempting to reuse an existing server on localhost:4096. */
export function createSDKClient(directory?: string): SDKClient {
  let serverHandle: ServerHandle | null = null;
  let client = createOpencodeClient({ directory });

  /** Probes port 4096, then starts a new server if unavailable. */
  const startServer = async (): Promise<ServerHandle> => {
    try {
      const testUrl = 'http://127.0.0.1:4096';
      const response = await fetch(testUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(1000),
      }).catch(() => null);
      // Reuse existing server if reachable
      if (response?.ok) {
        client = createOpencodeClient({ baseUrl: testUrl, directory });
        return {
          url: testUrl,
          close: () => {},
        };
      }
    } catch {
      /* server not running — will start a new one */
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
        const result = await client.session.get({ sessionID: id });
        if (!result.data) throw new Error('Failed to get session');
        return result.data;
      },
      update: async (id: string, patch: Partial<Session>): Promise<Session> => {
        const result = await client.session.update({
          sessionID: id,
          title: patch.title,
          permission: patch.permission,
          time: patch.time ? { archived: patch.time.archived } : undefined,
        });
        if (!result.data) throw new Error('Failed to update session');
        return result.data;
      },
      delete: async (id: string) => {
        await client.session.delete({ sessionID: id });
      },
      messages: async (id: string): Promise<Message[]> => {
        const result = await client.session.messages({ sessionID: id });
        return result.data?.map((m) => m.info) ?? [];
      },
      messagesWithParts: async (id: string): Promise<Array<{ info: Message; parts: Part[] }>> => {
        const result = await client.session.messages({ sessionID: id });
        return result.data ?? [];
      },
      /** Sends a prompt and blocks until the response is complete. */
      prompt: async (id: string, parts: Part[], model?: string, agent?: string) => {
        let modelObj: { providerID: string; modelID: string } | undefined;
        if (model) {
          const [providerID, modelID] = model.split('/');
          modelObj = { providerID, modelID };
        }
        await client.session.prompt({
          sessionID: id,
          parts: parts as Array<TextPartInput | FilePartInput | AgentPartInput | SubtaskPartInput>,
          model: modelObj,
          agent,
        });
      },
      /** Sends a prompt and returns immediately (non-blocking). */
      promptAsync: async (id: string, parts: Part[], model?: string, agent?: string) => {
        let modelObj: { providerID: string; modelID: string } | undefined;
        if (model) {
          const [providerID, modelID] = model.split('/');
          modelObj = { providerID, modelID };
        }
        await client.session.promptAsync({
          sessionID: id,
          parts: parts as Array<TextPartInput | FilePartInput | AgentPartInput | SubtaskPartInput>,
          model: modelObj,
          agent,
        });
      },
      abort: async (id: string) => {
        await client.session.abort({ sessionID: id });
      },
      command: async (
        id: string,
        cmd: string,
        args?: string,
        model?: string,
        agent?: string,
      ): Promise<void> => {
        const result = await client.session.command({
          sessionID: id,
          command: cmd,
          arguments: args,
          model,
          agent,
        });
        const typed = result as { data?: unknown; error?: unknown };
        if (typed.error) {
          const errMsg =
            typeof typed.error === 'string'
              ? typed.error
              : (typed.error as { message?: string }).message || JSON.stringify(typed.error);
          throw new Error(`Command "${cmd}" failed: ${errMsg}`);
        }
        console.log('[SDK] command succeeded:', cmd);
      },
    },
    lsp: {
      status: async (): Promise<LspStatus[]> => {
        const result = await client.lsp.status();
        return result.data ?? [];
      },
    },
    mcp: {
      status: async (): Promise<Record<string, McpStatus>> => {
        const result = await client.mcp.status();
        return result.data ?? {};
      },
    },
    config: {
      get: async (): Promise<Config> => {
        const result = await client.config.get();
        if (!result.data) throw new Error('Failed to get configuration');
        return result.data;
      },
    },
    permission: {
      reply: async (requestID: string, allow: boolean): Promise<void> => {
        await client.permission.reply({
          requestID,
          reply: allow ? 'once' : 'reject',
        });
      },
    },
    /** Subscribes to the SSE event stream and returns an unsubscribe callback. */
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
    /** Aggregates models from all providers, filtering out deprecated ones. */
    getModels: async (): Promise<
      Array<{
        id: string;
        name: string;
        providerId?: string;
        providerName?: string;
        isConnected?: boolean;
        contextLimit?: number;
      }>
    > => {
      const result = await client.provider.list();
      const providers = result.data?.all ?? [];
      const connected = result.data?.connected ?? [];
      const modelsList: Array<{
        id: string;
        name: string;
        providerId?: string;
        providerName?: string;
        isConnected?: boolean;
        contextLimit?: number;
      }> = [];
      for (const p of providers) {
        const isConnected = connected.includes(p.id);
        for (const mId of Object.keys(p.models || {})) {
          const model = p.models[mId];
          if (model.status === 'deprecated') continue;
          modelsList.push({
            id: `${p.id}/${model.id}`,
            name: model.name || model.id,
            providerId: p.id,
            providerName: p.name,
            isConnected,
            contextLimit: model.limit?.context,
          });
        }
      }
      return modelsList;
    },
    /** Fetches the available agent list from the server. */
    getAgents: async (): Promise<
      Array<{ id: string; name: string; mode?: string; hidden?: boolean }>
    > => {
      const result = await client.app.agents();
      const agents = result.data ?? [];
      return agents.map((a) => ({
        id: a.name,
        name: a.name,
        mode: a.mode,
        hidden: (a as { hidden?: boolean }).hidden,
      }));
    },
    /** Fetches the available skill list from the server. */
    getSkills: async (): Promise<
      Array<{ name: string; description?: string; location: string; content?: string }>
    > => {
      try {
        const result = await client.app.skills();
        return result.data ?? [];
      } catch (err) {
        console.error('Failed to get skills from SDK:', err);
        return [];
      }
    },
    /** Fetches the available command list from the server. */
    getCommands: async (): Promise<
      Array<{
        name: string;
        description?: string;
        source?: 'command' | 'mcp' | 'skill';
        agent?: string;
        model?: string;
        hints?: string[];
      }>
    > => {
      try {
        const result = await client.command.list();
        return (result.data ?? []).map((c) => ({
          name: c.name,
          description: c.description,
          source: c.source,
          agent: c.agent,
          model: c.model,
          hints: c.hints,
        }));
      } catch (err) {
        console.error('Failed to get commands from SDK:', err);
        return [];
      }
    },
  };
}
