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

  async sendPrompt(sessionID: string, parts: Part[]): Promise<void> {
    await this.sdk.session.prompt(sessionID, parts);
  }

  async abort(sessionID: string): Promise<void> {
    await this.sdk.session.abort(sessionID);
  }
}
