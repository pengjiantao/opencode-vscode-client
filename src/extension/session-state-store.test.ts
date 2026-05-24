/**
 * @file Unit tests for SessionStateStore.
 * Verifies session-isolated state loading, saving, defaulting, and legacy migrations.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Memento } from 'vscode';
import { SessionStateStore } from './session-state-store';
import { getConfiguration } from './utils/config';

// Mock config module to control settings in tests.
vi.mock('./utils/config', () => ({
  getConfiguration: vi.fn(),
}));

describe('SessionStateStore', () => {
  let mockMementoStore: Record<string, unknown>;
  let mockMemento: Memento;

  beforeEach(() => {
    mockMementoStore = {};
    mockMemento = {
      get: vi.fn((key: string, defaultValue?: unknown) => {
        return mockMementoStore[key] !== undefined ? mockMementoStore[key] : defaultValue;
      }),
      update: vi.fn((key: string, value: unknown) => {
        if (value === undefined) {
          delete mockMementoStore[key];
        } else {
          mockMementoStore[key] = value;
        }
        return Promise.resolve();
      }),
      keys: [],
    } as unknown as Memento;

    vi.mocked(getConfiguration).mockReturnValue({
      model: 'config-model',
      agent: 'config-agent',
      maxCacheFiles: 100,
    });
  });

  it('should return empty model/agent/variants when getting a session that does not exist', () => {
    const store = new SessionStateStore(mockMemento);
    const state = store.get('session-1');
    expect(state).toEqual({
      model: '',
      agent: '',
      modelVariants: {},
    });
  });

  it('should initialize and store defaults when getOrInitialize is called for a non-existent session', () => {
    const store = new SessionStateStore(mockMemento);
    const state = store.getOrInitialize(
      'session-new',
      [{ id: 'config-model', name: 'Config Model', isConnected: true }],
      [{ id: 'config-agent', name: 'Config Agent' }],
    );
    expect(state).toEqual({
      model: 'config-model',
      agent: 'config-agent',
      modelVariants: {},
    });
    // Verify it was persisted to memento
    expect(store.get('session-new')).toEqual({
      model: 'config-model',
      agent: 'config-agent',
      modelVariants: {},
    });
  });

  it('should retrieve existing state when getOrInitialize is called for an existing session', () => {
    const store = new SessionStateStore(mockMemento);
    const testState = {
      model: 'model-a',
      agent: 'agent-b',
      modelVariants: { 'model-a': 'variant-1' },
    };
    store.set('session-1', testState);

    const state = store.getOrInitialize(
      'session-1',
      [{ id: 'config-model', name: 'Config Model', isConnected: true }],
      [{ id: 'config-agent', name: 'Config Agent' }],
    );
    expect(state).toEqual(testState);
  });

  it('should retrieve stored session state correctly', () => {
    const store = new SessionStateStore(mockMemento);
    const testState = {
      model: 'model-a',
      agent: 'agent-b',
      modelVariants: { 'model-a': 'variant-1' },
    };
    store.set('session-1', testState);

    expect(store.get('session-1')).toEqual(testState);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockMemento.get).toHaveBeenCalledWith('sessionStates');
  });

  it('should support deleting session state', () => {
    const store = new SessionStateStore(mockMemento);
    const testState = {
      model: 'model-a',
      agent: 'agent-b',
      modelVariants: {},
    };
    store.set('session-1', testState);
    expect(store.get('session-1')).toEqual(testState);

    store.delete('session-1');
    expect(store.get('session-1')).toEqual({
      model: '',
      agent: '',
      modelVariants: {},
    });
  });

  describe('getDefaults', () => {
    it('should use configured model and agent if they are available', () => {
      const store = new SessionStateStore(mockMemento);
      const defaults = store.getDefaults(
        [
          { id: 'config-model', name: 'Config Model', isConnected: true },
          { id: 'other-model', name: 'Other Model', isConnected: true },
        ],
        [
          { id: 'config-agent', name: 'Config Agent' },
          { id: 'other-agent', name: 'Other Agent' },
        ],
      );
      expect(defaults).toEqual({
        model: 'config-model',
        agent: 'config-agent',
        modelVariants: {},
      });
    });

    it('should fallback to first available model/agent if config settings are not in the lists', () => {
      const store = new SessionStateStore(mockMemento);
      const defaults = store.getDefaults(
        [
          { id: 'other-model-1', name: 'Other Model 1', isConnected: true },
          { id: 'other-model-2', name: 'Other Model 2', isConnected: true },
        ],
        [
          { id: 'other-agent-1', name: 'Other Agent 1' },
          { id: 'other-agent-2', name: 'Other Agent 2' },
        ],
      );
      expect(defaults).toEqual({
        model: 'other-model-1',
        agent: 'other-agent-1',
        modelVariants: {},
      });
    });

    it('should prioritize connected models over disconnected ones when config is not set', () => {
      const store = new SessionStateStore(mockMemento);
      const defaults = store.getDefaults(
        [
          { id: 'disconnected-model', name: 'Disconnected Model', isConnected: false },
          { id: 'connected-model', name: 'Connected Model', isConnected: true },
        ],
        [{ id: 'other-agent', name: 'Other Agent' }],
      );
      expect(defaults.model).toBe('connected-model');
    });

    it('regression: should not fall back to the first disconnected SDK model', () => {
      const store = new SessionStateStore(mockMemento);
      vi.mocked(getConfiguration).mockReturnValue({
        model: '',
        agent: '',
        maxCacheFiles: 100,
      });

      const defaults = store.getDefaults(
        [
          { id: 'first-disconnected', name: 'First Disconnected', isConnected: false },
          { id: 'usable-connected', name: 'Usable Connected', isConnected: true },
        ],
        [],
      );

      expect(defaults.model).toBe('usable-connected');
    });

    it('should return empty string fallbacks if available lists are empty', () => {
      const store = new SessionStateStore(mockMemento);
      const defaults = store.getDefaults([], []);
      expect(defaults).toEqual({
        model: '',
        agent: '',
        modelVariants: {},
      });
    });
  });

  describe('migrateLegacyState', () => {
    it('should migrate legacy global state to the specified session and clear legacy keys', () => {
      const store = new SessionStateStore(mockMemento);
      mockMementoStore['lastUsedModel'] = 'legacy-model';
      mockMementoStore['lastUsedAgent'] = 'legacy-agent';
      mockMementoStore['modelVariants'] = { 'legacy-model': 'v1' };

      store.migrateLegacyState('session-target');

      expect(store.get('session-target')).toEqual({
        model: 'legacy-model',
        agent: 'legacy-agent',
        modelVariants: { 'legacy-model': 'v1' },
      });

      expect(mockMementoStore['lastUsedModel']).toBeUndefined();
      expect(mockMementoStore['lastUsedAgent']).toBeUndefined();
      expect(mockMementoStore['modelVariants']).toBeUndefined();
    });

    it('should not migrate if no legacy keys are present', () => {
      const store = new SessionStateStore(mockMemento);
      store.migrateLegacyState('session-target');

      expect(store.get('session-target')).toEqual({
        model: '',
        agent: '',
        modelVariants: {},
      });
    });

    it('should not overwrite existing session state during legacy migration', () => {
      const store = new SessionStateStore(mockMemento);
      const existingState = {
        model: 'existing-model',
        agent: 'existing-agent',
        modelVariants: { 'existing-model': 'v2' },
      };
      store.set('session-target', existingState);

      mockMementoStore['lastUsedModel'] = 'legacy-model';
      mockMementoStore['lastUsedAgent'] = 'legacy-agent';
      mockMementoStore['modelVariants'] = { 'legacy-model': 'v1' };

      store.migrateLegacyState('session-target');

      expect(store.get('session-target')).toEqual(existingState);

      // Legacy keys should still be cleared
      expect(mockMementoStore['lastUsedModel']).toBeUndefined();
      expect(mockMementoStore['lastUsedAgent']).toBeUndefined();
      expect(mockMementoStore['modelVariants']).toBeUndefined();
    });
  });
});
