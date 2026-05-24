/**
 * @file Unit tests for session state IPC handlers.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IPCBridge, MessageHandler } from './ipc';
import type { SessionManager } from './session-manager';
import { registerSessionStateHandlers } from './session-state-ipc-handlers';
import type { SessionState, SessionStateStore } from './session-state-store';

describe('registerSessionStateHandlers', () => {
  let handlers: Map<string, MessageHandler>;
  let states: Record<string, SessionState>;
  let sessionStateStore: SessionStateStore;

  beforeEach(() => {
    handlers = new Map();
    states = {
      'active-session': { model: 'active/model', agent: 'build', modelVariants: {} },
      'target-session': { model: 'target/old-model', agent: 'plan', modelVariants: {} },
    };
    sessionStateStore = {
      getOrInitialize: vi.fn((sessionID: string): SessionState => {
        states[sessionID] = states[sessionID] || { model: '', agent: '', modelVariants: {} };
        return states[sessionID];
      }),
      set: vi.fn((sessionID: string, state: SessionState) => {
        states[sessionID] = { ...state, modelVariants: { ...state.modelVariants } };
      }),
    } as unknown as SessionStateStore;
  });

  it('regression: persists model switches to the message session instead of active fallback', () => {
    const ipc = {
      on: vi.fn((type: string, handler: MessageHandler) => handlers.set(type, handler)),
    } as unknown as IPCBridge;
    const sessionManager = { activeSessionID: 'active-session' } as unknown as SessionManager;

    registerSessionStateHandlers({
      ipc,
      sessionManager,
      sessionStateStore,
      getCachedModels: () => [],
      getCachedAgents: () => [],
      syncMetadata: vi.fn(),
    });

    void handlers.get('model:switch')?.({
      type: 'model:switch',
      sessionID: 'target-session',
      model: 'target/new-model',
    });

    expect(states['target-session'].model).toBe('target/new-model');
    expect(states['active-session'].model).toBe('active/model');
  });

  it('keeps backward compatibility by using the active session when sessionID is absent', () => {
    const ipc = {
      on: vi.fn((type: string, handler: MessageHandler) => handlers.set(type, handler)),
    } as unknown as IPCBridge;
    const sessionManager = { activeSessionID: 'active-session' } as unknown as SessionManager;

    registerSessionStateHandlers({
      ipc,
      sessionManager,
      sessionStateStore,
      getCachedModels: () => [],
      getCachedAgents: () => [],
      syncMetadata: vi.fn(),
    });

    void handlers.get('model:switch')?.({ type: 'model:switch', model: 'active/new-model' });

    expect(states['active-session'].model).toBe('active/new-model');
  });
});
