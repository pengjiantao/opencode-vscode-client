/**
 * @file Manages OpenCode session lifecycle on the extension host side.
 * Handles creation, switching, archiving, and prompt operations with state tracking.
 */

import type { Message, Part, Session } from '@opencode-ai/sdk/v2/client';
import type { SDKClient } from './sdk-client';

/** Current state of the session manager. */
export interface SessionManagerState {
  activeSessionID: string | null;
  sessions: Session[];
  isConnected: boolean;
}

/** Manages session lifecycle and delegates data operations to the SDK client. */
export class SessionManager {
  private sdk: SDKClient;
  private _state: SessionManagerState = {
    activeSessionID: null,
    sessions: [],
    isConnected: false,
  };
  private listeners: Set<(state: SessionManagerState) => void> = new Set();

  constructor(sdk: SDKClient) {
    this.sdk = sdk;
  }

  get state() {
    return this._state;
  }

  get activeSessionID(): string | null {
    return this._state.activeSessionID;
  }

  private setState(partial: Partial<SessionManagerState>) {
    this._state = { ...this._state, ...partial };
    this.notify();
  }

  /** Subscribes to state changes. Returns an unsubscribe function. */
  subscribe(listener: (state: SessionManagerState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  /** Replaces the session list without changing active session. */
  setSessions(sessions: Session[]): void {
    this.setState({ sessions });
  }

  /** Starts the SDK server and marks as connected. */
  async connect(): Promise<void> {
    await this.sdk.startServer();
    this.setState({ isConnected: true });
  }

  /** Creates a new session and sets it as active. */
  async create(title?: string): Promise<Session> {
    const session = await this.sdk.session.create();

    if (title) {
      await this.sdk.session.update(session.id, { title });
    }

    this.setState({
      sessions: [...this.state.sessions, session],
      activeSessionID: session.id,
    });

    return session;
  }

  /** Switches the active session by ID. Throws if not found. */
  switch(id: string): void {
    if (!this.state.sessions.find((s) => s.id === id)) {
      throw new Error(`Session ${id} not found`);
    }
    this.setState({ activeSessionID: id });
  }

  /** Archives a session by setting an archived timestamp, then removes from local state. */
  async archive(id: string): Promise<void> {
    const session = this.state.sessions.find((s) => s.id === id);
    if (!session) {
      throw new Error(`Session ${id} not found`);
    }

    await this.sdk.session.update(id, {
      time: { ...session.time, archived: Date.now() },
    });

    const remaining = this.state.sessions.filter((s) => s.id !== id);
    this.setState({
      sessions: remaining,
      activeSessionID: this.state.activeSessionID === id ? null : this.state.activeSessionID,
    });
  }

  /** Retrieves messages for a session. */
  async getMessages(id: string): Promise<Message[]> {
    return this.sdk.session.messages(id);
  }

  /** Retrieves messages with their associated parts for a session. */
  async getMessagesAndParts(id: string): Promise<{ messages: Message[]; parts: Part[] }> {
    const list = await this.sdk.session.messagesWithParts(id);
    const messages: Message[] = [];
    const parts: Part[] = [];
    for (const m of list) {
      messages.push(m.info);
      parts.push(...m.parts);
    }
    return { messages, parts };
  }

  /** Sends a prompt with cleaned parts (strips ambient SDK fields to avoid schema validation errors). */
  async sendPrompt(
    sessionID: string,
    parts: Part[],
    model?: string,
    agent?: string,
    variant?: string,
  ): Promise<void> {
    /* Clean parts array to strictly adhere to the backend's PromptInput schema
       (removing ambient/extra fields like sessionID and messageID to avoid Schema validation errors) */
    const cleanedParts = parts.map((part) => {
      if (part.type === 'text') {
        return {
          type: 'text',
          text: part.text,
          synthetic: part.synthetic,
          ignored: part.ignored,
          time: part.time,
          metadata: part.metadata,
        } as unknown as Part;
      }
      if (part.type === 'file') {
        const isImageOrPdf = part.mime.startsWith('image/') || part.mime === 'application/pdf';
        const isDirectory = part.mime === 'directory' || part.mime === 'application/x-directory';
        const finalMime = isImageOrPdf || isDirectory ? part.mime : 'text/plain';
        let finalUrl = part.url;
        if (!isImageOrPdf && part.url.startsWith('data:')) {
          const commaIndex = part.url.indexOf(',');
          if (commaIndex !== -1) {
            const meta = part.url.substring(0, commaIndex);
            const content = part.url.substring(commaIndex + 1);
            if (meta.includes(';base64')) {
              finalUrl = `data:text/plain;base64,${content}`;
            } else {
              let decoded = content;
              try {
                decoded = decodeURIComponent(content);
              } catch {
                // fallback if not a valid URI-encoded string
              }
              const base64 = Buffer.from(decoded).toString('base64');
              finalUrl = `data:text/plain;base64,${base64}`;
            }
          }
        }
        return {
          type: 'file',
          mime: finalMime,
          filename: part.filename,
          url: finalUrl,
          source: part.source,
        } as unknown as Part;
      }
      if (part.type === 'agent') {
        return {
          type: 'agent',
          name: part.name,
          source: part.source,
        } as unknown as Part;
      }
      return part;
    });

    await this.sdk.session.promptAsync(sessionID, cleanedParts, model, agent, variant);
  }

  /** Sends a built-in command for execution with optional arguments. */
  async sendCommand(
    sessionID: string,
    command: string,
    args?: string,
    model?: string,
    agent?: string,
    variant?: string,
  ): Promise<void> {
    await this.sdk.session.command(sessionID, command, args, model, agent, variant);
  }

  /** Aborts a running prompt for the given session. */
  async abort(sessionID: string): Promise<void> {
    await this.sdk.session.abort(sessionID);
  }
}
