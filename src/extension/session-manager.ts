import type { Message, Part, Session } from '@opencode-ai/sdk';
import type { SDKClient } from './sdk-client';

export interface SessionManagerState {
  activeSessionID: string | null;
  sessions: Session[];
  isConnected: boolean;
}

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

  subscribe(listener: (state: SessionManagerState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  setSessions(sessions: Session[]): void {
    this.setState({ sessions });
  }

  async connect(): Promise<void> {
    await this.sdk.startServer();
    this.setState({ isConnected: true });
  }

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

  switch(id: string): void {
    if (!this.state.sessions.find((s) => s.id === id)) {
      throw new Error(`Session ${id} not found`);
    }
    this.setState({ activeSessionID: id });
  }

  async archive(id: string): Promise<void> {
    const session = this.state.sessions.find((s) => s.id === id);
    if (!session) {
      throw new Error(`Session ${id} not found`);
    }

    await this.sdk.session.update(id, {
      time: { ...session.time, archived: Date.now() },
    } as Partial<Session>);

    const remaining = this.state.sessions.filter((s) => s.id !== id);
    this.setState({
      sessions: remaining,
      activeSessionID: this.state.activeSessionID === id ? null : this.state.activeSessionID,
    });
  }

  async getMessages(id: string): Promise<Message[]> {
    return this.sdk.session.messages(id);
  }

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

  async sendPrompt(
    sessionID: string,
    parts: Part[],
    model?: string,
    agent?: string,
  ): Promise<void> {
    // Clean parts array to strictly adhere to the backend's PromptInput schema
    // (removing ambient/extra fields like sessionID and messageID to avoid Schema validation errors)
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
        return {
          type: 'file',
          mime: part.mime,
          filename: part.filename,
          url: part.url,
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

    await this.sdk.session.promptAsync(sessionID, cleanedParts, model, agent);
  }

  async abort(sessionID: string): Promise<void> {
    await this.sdk.session.abort(sessionID);
  }
}
