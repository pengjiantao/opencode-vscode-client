import type { Message, Part, Session } from '@opencode-ai/sdk';

export interface ServerHandle {
  url: string;
  close(): void;
}

export interface SDKClient {
  startServer(): Promise<ServerHandle>;
  session: {
    create(): Promise<Session>;
    list(): Promise<Session[]>;
    get(id: string): Promise<Session>;
    update(id: string, patch: Partial<Session>): Promise<Session>;
    delete(id: string): Promise<void>;
    messages(id: string): Promise<Message[]>;
    messagesWithParts(id: string): Promise<Array<{ info: Message; parts: Part[] }>>;
    prompt(id: string, parts: Part[], model?: string, agent?: string): Promise<void>;
    promptAsync(id: string, parts: Part[], model?: string, agent?: string): Promise<void>;
    abort(id: string): Promise<void>;
  };
  subscribeEvents(handler: (event: unknown) => void): () => void;
  getModels(): Promise<
    Array<{
      id: string;
      name: string;
      providerId?: string;
      providerName?: string;
      isConnected?: boolean;
    }>
  >;
  getAgents(): Promise<Array<{ id: string; name: string; mode?: string; hidden?: boolean }>>;
}
