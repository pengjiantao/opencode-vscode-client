/**
 * @file Manages OpenCode session lifecycle on the extension host side.
 * Handles creation, switching, archiving, and prompt operations with state tracking.
 */

import type { Message, Part, Session } from '@opencode-ai/sdk/v2/client';
import type { Memento } from 'vscode';
import type { SDKClient, ServerHandle } from './sdk-client';

/** Current state of the session manager. */
export interface SessionManagerState {
  activeSessionID: string | null;
}

/** Manages session lifecycle, delegates data operations to the SDK client, and persists session states. */
export class SessionManager {
  private sdk: SDKClient;
  private workspaceState?: Memento;
  private listeners: Set<(state: SessionManagerState) => void> = new Set();

  /**
   * Constructs the SessionManager.
   *
   * @param sdk The SDKClient instance.
   * @param workspaceState Optional VS Code Memento for persistent state.
   */
  constructor(sdk: SDKClient, workspaceState?: Memento) {
    this.sdk = sdk;
    this.workspaceState = workspaceState;
  }

  /**
   * Gets the current state representation.
   *
   * @returns The SessionManagerState.
   */
  get state(): SessionManagerState {
    return {
      activeSessionID: this.activeSessionID,
    };
  }

  /**
   * Gets the active session ID from persistent state.
   *
   * @returns The active session ID, or null.
   */
  get activeSessionID(): string | null {
    return this.workspaceState?.get<string>('activeSessionID') || null;
  }

  /**
   * Subscribes to state changes. Returns an unsubscribe function.
   *
   * @param listener The listener callback function.
   * @returns An unsubscribe function.
   */
  subscribe(listener: (state: SessionManagerState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notifies subscribers of the latest state.
   */
  private notify() {
    const currentState = this.state;
    for (const listener of this.listeners) {
      listener(currentState);
    }
  }

  /**
   * Retrieves the list of open session IDs from workspaceState.
   *
   * @returns An array of open session IDs.
   */
  getOpenSessionIDs(): string[] {
    return this.workspaceState?.get<string[]>('openSessionIDs') || [];
  }

  /**
   * Persists the list of open session IDs to workspaceState.
   *
   * @param ids The array of open session IDs to save.
   */
  async setOpenSessionIDs(ids: string[]): Promise<void> {
    await this.workspaceState?.update('openSessionIDs', ids);
  }

  /**
   * Persists the active session ID to workspaceState and notifies subscribers.
   *
   * @param id The active session ID to save, or null.
   */
  async setActiveSessionID(id: string | null): Promise<void> {
    await this.workspaceState?.update('activeSessionID', id || undefined);
    this.notify();
  }

  /**
   * Starts the SDK server and returns the server handle.
   *
   * @returns A promise resolving to the ServerHandle.
   */
  async connect(): Promise<ServerHandle> {
    return this.sdk.startServer();
  }

  /**
   * Creates a new session, sets it as active, and persists state.
   *
   * @param title Optional title for the new session.
   * @returns A promise resolving to the created Session.
   */
  async create(title?: string): Promise<Session> {
    const session = await this.sdk.session.create();

    if (title) {
      await this.sdk.session.update(session.id, { title });
    }

    const openIDs = this.getOpenSessionIDs();
    if (!openIDs.includes(session.id)) {
      openIDs.push(session.id);
      await this.setOpenSessionIDs(openIDs);
    }
    await this.setActiveSessionID(session.id);

    return session;
  }

  /**
   * Switches the active session by ID and persists state. Throws if not found.
   *
   * @param id The session ID to switch to.
   */
  async switch(id: string): Promise<void> {
    const openIDs = this.getOpenSessionIDs();
    if (!openIDs.includes(id)) {
      throw new Error(`Session ${id} not found`);
    }
    await this.setActiveSessionID(id);
  }

  /**
   * Archives a session, removes it from open sessions, switches active session if needed, and persists state.
   *
   * @param id The session ID to archive.
   */
  async archive(id: string): Promise<void> {
    let openIDs = this.getOpenSessionIDs();
    if (!openIDs.includes(id)) {
      throw new Error(`Session ${id} not found`);
    }

    const session = await this.sdk.session.get(id);

    // Set archived timestamp in backend session state via SDK patch
    await this.sdk.session.update(id, {
      time: { ...session.time, archived: Date.now() },
    });

    const wasActive = this.activeSessionID === id;
    openIDs = openIDs.filter((oid) => oid !== id);
    await this.setOpenSessionIDs(openIDs);

    if (wasActive) {
      const nextActiveID = openIDs.length > 0 ? openIDs[openIDs.length - 1] : null;
      await this.setActiveSessionID(nextActiveID);
    } else {
      this.notify();
    }
  }

  /**
   * Closes a session by removing it from open sessions list, switches active session if needed, and persists state.
   *
   * @param id The session ID to close.
   */
  async close(id: string): Promise<void> {
    let openIDs = this.getOpenSessionIDs();
    const wasActive = this.activeSessionID === id;

    if (!openIDs.includes(id)) {
      return; // If already closed, do nothing
    }

    openIDs = openIDs.filter((oid) => oid !== id);
    await this.setOpenSessionIDs(openIDs);

    if (wasActive) {
      const nextActiveID = openIDs.length > 0 ? openIDs[openIDs.length - 1] : null;
      await this.setActiveSessionID(nextActiveID);
    } else {
      this.notify();
    }
  }

  /**
   * Closes all open sessions, clearing the persistence storage.
   */
  async closeAll(): Promise<void> {
    await this.setOpenSessionIDs([]);
    await this.setActiveSessionID(null);
  }

  /**
   * Retrieves messages for a session.
   *
   * @param id The session ID.
   * @returns A promise resolving to an array of Message.
   */
  async getMessages(id: string): Promise<Message[]> {
    return this.sdk.session.messages(id);
  }

  /**
   * Retrieves messages with their associated parts for a session.
   *
   * @param id The session ID.
   * @returns A promise resolving to an object containing messages and parts.
   */
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

  /**
   * Sends a prompt with cleaned parts (strips ambient SDK fields to avoid schema validation errors).
   *
   * @param sessionID The session ID.
   * @param parts The parts array to send.
   * @param model The target model ID.
   * @param agent The target agent ID.
   * @param variant The reasoning variant name.
   */
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

    await this.sdk.session.promptAsync({
      id: sessionID,
      parts: cleanedParts,
      model,
      agent,
      variant,
    });
  }

  /**
   * Sends a built-in command for execution with optional arguments.
   *
   * @param sessionID The session ID.
   * @param command The command name.
   * @param args The optional arguments for the command.
   * @param model The target model ID.
   * @param agent The target agent ID.
   * @param variant The reasoning variant name.
   */
  async sendCommand(
    sessionID: string,
    command: string,
    args?: string,
    model?: string,
    agent?: string,
    variant?: string,
  ): Promise<void> {
    await this.sdk.session.command({
      id: sessionID,
      cmd: command,
      args,
      model,
      agent,
      variant,
    });
  }

  /**
   * Aborts a running prompt for the given session.
   *
   * @param sessionID The session ID to abort.
   */
  async abort(sessionID: string): Promise<void> {
    await this.sdk.session.abort(sessionID);
  }
}
