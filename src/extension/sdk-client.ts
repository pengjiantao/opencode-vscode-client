/**
 * @file SDK client interface definitions.
 * Abstracts the OpenCode SDK operations for testability and decoupling.
 */

import type { Message, Part, Session } from '@opencode-ai/sdk';

/** Handle for a managed OpenCode server instance. */
export interface ServerHandle {
  url: string;
  close(): void;
}

/** Interface for all SDK operations used by the extension host. */
export interface SDKClient {
  /** Starts or connects to an OpenCode server. */
  startServer(): Promise<ServerHandle>;
  session: {
    create(): Promise<Session>;
    list(): Promise<Session[]>;
    get(id: string): Promise<Session>;
    update(id: string, patch: Partial<Session>): Promise<Session>;
    delete(id: string): Promise<void>;
    messages(id: string): Promise<Message[]>;
    messagesWithParts(id: string): Promise<Array<{ info: Message; parts: Part[] }>>;
    /** Sends a prompt and waits for completion (blocking). */
    prompt(id: string, parts: Part[], model?: string, agent?: string): Promise<void>;
    /** Sends a prompt without waiting for completion (non-blocking). */
    promptAsync(id: string, parts: Part[], model?: string, agent?: string): Promise<void>;
    abort(id: string): Promise<void>;
  };
  /** Subscribes to SSE events from the server. Returns an unsubscribe function. */
  subscribeEvents(handler: (event: unknown) => void): () => void;
  /** Retrieves the list of available models from connected providers. */
  getModels(): Promise<
    Array<{
      id: string;
      name: string;
      providerId?: string;
      providerName?: string;
      isConnected?: boolean;
    }>
  >;
  /** Retrieves the list of available agent configurations. */
  getAgents(): Promise<Array<{ id: string; name: string; mode?: string; hidden?: boolean }>>;
}
