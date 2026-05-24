/**
 * @file SessionStateStore.
 * Manages per-session configuration state (model, agent, variant mapping)
 * using VS Code globalState to ensure complete isolation between chat sessions.
 */

import type { Memento } from 'vscode';
import { resolveDefaultModelId } from '../shared/model-selection';
import type { AgentInfo, ModelInfo } from './types';
import { getConfiguration } from './utils/config';

/**
 * Represents the isolated state settings for a single chat session.
 */
export interface SessionState {
  /** The selected model ID. */
  model: string;
  /** The selected agent ID. */
  agent: string;
  /** Map of model ID to last selected variant. */
  modelVariants: Record<string, string>;
}

/**
 * Manages reading, writing, and lifecycle of session-specific model/agent states.
 */
export class SessionStateStore {
  private readonly globalState: Memento;

  /**
   * Creates a SessionStateStore instance.
   * @param globalState The VS Code global state storage memento.
   */
  constructor(globalState: Memento) {
    this.globalState = globalState;
  }

  /**
   * Retrieves the state for a given session.
   * Falls back to defaults if no state exists yet.
   * @param sessionId The active session identifier.
   * @returns The session's state parameters.
   */
  public get(sessionId: string): SessionState {
    const states = this.globalState.get<Record<string, SessionState>>('sessionStates') || {};
    return states[sessionId] || { model: '', agent: '', modelVariants: {} };
  }

  /**
   * Retrieves the state for a given session, initializing it with defaults if not present.
   * @param sessionId The active session identifier.
   * @param models List of available models.
   * @param agents List of available agents.
   * @returns The resolved session state.
   */
  public getOrInitialize(
    sessionId: string,
    models: ModelInfo[],
    agents: AgentInfo[],
  ): SessionState {
    const states = this.globalState.get<Record<string, SessionState>>('sessionStates') || {};
    if (!states[sessionId]) {
      const defaultState = this.getDefaults(models, agents);
      states[sessionId] = defaultState;
      void this.globalState.update('sessionStates', states);
      return defaultState;
    }
    return states[sessionId];
  }

  /**
   * Saves the state for a given session.
   * @param sessionId The active session identifier.
   * @param state The state to save.
   */
  public set(sessionId: string, state: SessionState): void {
    const states = this.globalState.get<Record<string, SessionState>>('sessionStates') || {};
    states[sessionId] = state;
    void this.globalState.update('sessionStates', states);
  }

  /**
   * Deletes state storage associated with a closed/archived session.
   * @param sessionId The session identifier to clean up.
   */
  public delete(sessionId: string): void {
    const states = this.globalState.get<Record<string, SessionState>>('sessionStates') || {};
    if (sessionId in states) {
      delete states[sessionId];
      void this.globalState.update('sessionStates', states);
    }
  }

  /**
   * Generates a default state when a new session is initialized.
   * Uses extension configuration settings with fallback to available SDK resources.
   * @param models List of available models received from the backend.
   * @param agents List of available agents received from the backend.
   * @returns The default session state initialized with configuration fallbacks.
   */
  public getDefaults(models: ModelInfo[], agents: AgentInfo[]): SessionState {
    const config = getConfiguration();

    // Prefer config setting, fallback to first available connected SDK model, then first available model, then empty string.
    let model = config.model;
    const modelIds = models.map((m) => m.id);

    if (!model || !modelIds.includes(model)) {
      model = resolveDefaultModelId(models);
    }

    // Prefer config setting, fallback to first available SDK agent, then empty string.
    let agent = config.agent;
    const agentIds = agents.map((a) => a.id);
    if (!agent || !agentIds.includes(agent)) {
      agent = agentIds.length > 0 ? agentIds[0] : '';
    }
    return {
      model,
      agent,
      modelVariants: {},
    };
  }
  /**
   * Migrates legacy global single-session configurations to the new isolated store format.
   * Cleans up legacy keys once the initial session has been migrated.
   * @param defaultSessionId The target session to migrate legacy settings into.
   */
  public migrateLegacyState(defaultSessionId: string): void {
    const legacyModel = this.globalState.get<string>('lastUsedModel');
    const legacyAgent = this.globalState.get<string>('lastUsedAgent');
    const legacyVariants = this.globalState.get<Record<string, string>>('modelVariants');

    // Only initiate migration if legacy keys exist in globalState.
    if (legacyModel !== undefined || legacyAgent !== undefined || legacyVariants !== undefined) {
      const states = this.globalState.get<Record<string, SessionState>>('sessionStates') || {};

      if (!states[defaultSessionId]) {
        states[defaultSessionId] = {
          model: legacyModel || '',
          agent: legacyAgent || '',
          modelVariants: legacyVariants || {},
        };
        void this.globalState.update('sessionStates', states);
      }

      // Evict legacy keys to avoid running migration on subsequent boots.
      void this.globalState.update('lastUsedModel', undefined);
      void this.globalState.update('lastUsedAgent', undefined);
      void this.globalState.update('modelVariants', undefined);
    }
  }
}
