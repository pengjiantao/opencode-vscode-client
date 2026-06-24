/**
 * @file SDK client interface definitions.
 * Abstracts the OpenCode SDK operations for testability and decoupling.
 */

import type {
  Config,
  LspStatus,
  McpStatus,
  Message,
  Part,
  Session,
  SessionStatus,
  SnapshotFileDiff,
} from '@opencode-ai/sdk/v2/client';
import type { AgentInfo, CommandInfo, ModelInfo, SkillInfo } from './types';

/** Handle for a managed OpenCode server instance. */
export interface ServerHandle {
  url: string;
  close(): void;
}

/** Options for sending a prompt to the SDK client. */
export interface PromptOptions {
  /** The session ID. */
  id: string;
  /** The list of message parts to send. */
  parts: Part[];
  /** Optional model identifier (e.g. 'provider/model-id'). */
  model?: string;
  /** Optional agent configuration identifier. */
  agent?: string;
  /** Optional reasoning variant configuration. */
  variant?: string;
}

/** Options for sending a built-in or user-defined command to the SDK client. */
export interface CommandOptions {
  /** The session ID. */
  id: string;
  /** The command string (e.g. /explain). */
  cmd: string;
  /** Optional arguments for the command. */
  args?: string;
  /** Optional model identifier. */
  model?: string;
  /** Optional agent configuration identifier. */
  agent?: string;
  /** Optional reasoning variant configuration. */
  variant?: string;
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
    prompt(options: PromptOptions): Promise<void>;
    /** Sends a prompt without waiting for completion (non-blocking). */
    promptAsync(options: PromptOptions): Promise<void>;
    abort(id: string): Promise<void>;
    /**
     * Retrieves the current status of every session known to the backend, keyed by session ID.
     * Used to seed the in-memory status cache after an extension restart so the UI can
     * immediately reflect running (busy/retry) sessions without waiting for the next SSE event.
     */
    statusAll(): Promise<Record<string, SessionStatus>>;
    /** Sends a built-in command for execution. */
    command(options: CommandOptions): Promise<void>;
    /** Reverts a message and all subsequent messages, undoing file changes. */
    revert(sessionID: string, messageID: string, partID?: string): Promise<Session>;
    /** Restores previously reverted messages, redoing file changes. */
    unrevert(sessionID: string): Promise<Session>;
    /** Forks a session, optionally at a specific message. Returns the new session. */
    fork(sessionID: string, messageID?: string): Promise<Session>;
    /** Retrieves file diffs for a session, optionally filtered by message ID. */
    diff(sessionID: string, messageID?: string): Promise<SnapshotFileDiff[]>;
  };
  lsp: {
    status(): Promise<LspStatus[]>;
  };
  mcp: {
    status(): Promise<Record<string, McpStatus>>;
  };
  config: {
    get(): Promise<Config>;
  };
  permission: {
    reply(requestID: string, reply: 'once' | 'always' | 'reject'): Promise<void>;
  };
  /** Operations for responding to interactive question requests from the AI assistant. */
  question: {
    /** Sends the selected answers to a question request. */
    reply(requestID: string, answers: string[][]): Promise<void>;
    /** Rejects/dismisses a question request. */
    reject(requestID: string): Promise<void>;
  };
  /** Subscribes to SSE events from the server. Returns an unsubscribe function. */
  subscribeEvents(handler: (event: unknown) => void): () => void;
  /**
   * Retrieves the opencode server health information including the running version.
   * Used by the metadata sync to surface the opencode version in the about tooltip.
   */
  getServerVersion(): Promise<{ version: string; healthy: boolean }>;
  /** Retrieves the list of available models from connected providers. */
  getModels(): Promise<ModelInfo[]>;
  /** Retrieves the list of available agent configurations. */
  getAgents(): Promise<AgentInfo[]>;
  /** Retrieves the list of available skills. */
  getSkills(): Promise<SkillInfo[]>;
  /** Retrieves the list of available built-in and user-defined commands. */
  getCommands(): Promise<CommandInfo[]>;
  find: {
    /** Searches for files by name or pattern using the opencode backend. */
    files(query: string, limit?: number): Promise<string[]>;
  };
}
