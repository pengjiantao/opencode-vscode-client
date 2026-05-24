/**
 * @file Concrete implementation of the SDKClient interface.
 * Manages server lifecycle (starts a dedicated server per client instance)
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
import type { CommandOptions, PromptOptions, SDKClient, ServerHandle } from './sdk-client';
import type { AgentInfo, CommandInfo, ModelInfo, SkillInfo } from './types';

/** Creates a configured SDK client. Every client instance starts its own dedicated server. */
export function createSDKClient(directory?: string): SDKClient {
  let serverHandle: ServerHandle | null = null;
  let client = createOpencodeClient({ directory });

  /** Starts a new dedicated server for this client instance. */
  const startServer = async (): Promise<ServerHandle> => {
    // Spawn the opencode server on a free port (port fallback is handled by the SDK).
    const server = await createOpencodeServer({ port: 0 });
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
      prompt: async (options: PromptOptions) => {
        const { id, parts, model, agent, variant } = options;
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
          variant, // Pass reasoning variant configuration to SDK prompt call
        });
      },
      /** Sends a prompt and returns immediately (non-blocking). */
      promptAsync: async (options: PromptOptions) => {
        const { id, parts, model, agent, variant } = options;
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
          variant, // Pass reasoning variant configuration to SDK async prompt call
        });
      },
      abort: async (id: string) => {
        await client.session.abort({ sessionID: id });
      },
      command: async (options: CommandOptions): Promise<void> => {
        const { id, cmd, args, model, agent, variant } = options;
        const result = await client.session.command({
          sessionID: id,
          command: cmd,
          arguments: args,
          model,
          agent,
          variant, // Pass reasoning variant configuration to SDK command call
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
      reply: async (requestID: string, reply: 'once' | 'always' | 'reject'): Promise<void> => {
        const result = await client.permission.reply({
          requestID,
          reply,
        });
        const typed = result as {
          error?: { name?: string; data?: { message?: string } } | string;
        };
        if (typed.error) {
          const errMsg =
            typeof typed.error === 'string'
              ? typed.error
              : typed.error.data?.message || typed.error.name || 'Permission reply failed';
          throw new Error(errMsg);
        }
      },
    },
    question: {
      reply: async (requestID: string, answers: string[][]): Promise<void> => {
        const result = await client.question.reply({
          requestID,
          answers,
        });
        const typed = result as {
          error?: { name?: string; data?: { message?: string } } | string;
        };
        if (typed.error) {
          const errMsg =
            typeof typed.error === 'string'
              ? typed.error
              : typed.error.data?.message || typed.error.name || 'Question reply failed';
          throw new Error(errMsg);
        }
      },
      reject: async (requestID: string): Promise<void> => {
        const result = await client.question.reject({
          requestID,
        });
        const typed = result as {
          error?: { name?: string; data?: { message?: string } } | string;
        };
        if (typed.error) {
          const errMsg =
            typeof typed.error === 'string'
              ? typed.error
              : typed.error.data?.message || typed.error.name || 'Question reject failed';
          throw new Error(errMsg);
        }
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
    getModels: async (): Promise<ModelInfo[]> => {
      const result = await client.provider.list();
      const providers = result.data?.all ?? [];
      const connected = result.data?.connected ?? [];
      const modelsList: ModelInfo[] = [];
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
            // Extract the list of available variant names from provider model configurations
            variants: model.variants ? Object.keys(model.variants) : undefined,
          });
        }
      }
      return modelsList;
    },
    /** Fetches the available agent list from the server. */
    getAgents: async (): Promise<AgentInfo[]> => {
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
    getSkills: async (): Promise<SkillInfo[]> => {
      try {
        const result = await client.app.skills();
        return result.data ?? [];
      } catch (err) {
        console.error('Failed to get skills from SDK:', err);
        return [];
      }
    },
    /** Fetches the available command list from the server. */
    getCommands: async (): Promise<CommandInfo[]> => {
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
