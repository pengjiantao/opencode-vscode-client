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
    prompt(id: string, parts: Part[]): Promise<void>;
    promptAsync(id: string, parts: Part[]): Promise<void>;
    abort(id: string): Promise<void>;
  };
  subscribeEvents(handler: (event: unknown) => void): () => void;
}
