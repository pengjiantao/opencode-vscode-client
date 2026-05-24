/**
 * @file Unit tests for SessionManager — session CRUD, switching, archiving, and prompt sanitization.
 */

import type { Part } from '@opencode-ai/sdk/v2/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Memento } from 'vscode';
import type { PromptOptions, SDKClient } from './sdk-client';
import { SessionManager } from './session-manager';

describe('SessionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('switch functionality', () => {
    it('should switch active session correctly', async () => {
      const mockSdk = {} as unknown as SDKClient;
      const mockState: Record<string, unknown> = {};
      const mockMemento = {
        get: vi.fn((key: string, defaultValue?: unknown) => {
          return mockState[key] !== undefined ? mockState[key] : defaultValue;
        }),
        update: vi.fn((key: string, value: unknown) => {
          mockState[key] = value;
          return Promise.resolve();
        }),
        keys: vi.fn().mockReturnValue([]),
      } as unknown as Memento;
      const manager = new SessionManager(mockSdk, mockMemento);
      await manager.setOpenSessionIDs(['s1', 's2']);

      await manager.switch('s2');
      expect(manager.activeSessionID).toBe('s2');

      await expect(manager.switch('non-existent')).rejects.toThrowError(
        'Session non-existent not found',
      );
    });
  });

  /** Regression test: verifies that extra SDK fields are stripped before sending. */
  describe('sendPrompt regression test', () => {
    it('should sanitize parts and call promptAsync with cleaned parts', async () => {
      const mockPromptAsync = vi.fn().mockResolvedValue(undefined);
      const mockSdk = {
        session: {
          promptAsync: mockPromptAsync,
        },
      } as unknown as SDKClient;
      const manager = new SessionManager(mockSdk);

      const messyParts = [
        {
          type: 'text',
          id: 'temp',
          sessionID: 's1',
          messageID: 'temp',
          text: 'Hello, World!',
          synthetic: false,
          ignored: false,
        } as unknown as Part,
      ];

      await manager.sendPrompt('s1', messyParts, 'openai/gpt-4o', 'coder');

      expect(mockPromptAsync).toHaveBeenCalledTimes(1);
      expect(mockPromptAsync).toHaveBeenCalledWith({
        id: 's1',
        parts: [
          {
            type: 'text',
            text: 'Hello, World!',
            synthetic: false,
            ignored: false,
            time: undefined,
            metadata: undefined,
          },
        ],
        model: 'openai/gpt-4o',
        agent: 'coder',
        variant: undefined,
      });
    });

    it('regression: should sanitize file parts and handle data URL base64 rewriting correctly', async () => {
      const mockPromptAsync = vi.fn().mockResolvedValue(undefined);
      const mockSdk = {
        session: {
          promptAsync: mockPromptAsync,
        },
      } as unknown as SDKClient;
      const manager = new SessionManager(mockSdk);

      const parts = [
        {
          type: 'file',
          mime: 'text/markdown',
          url: 'data:text/markdown;base64,IyBDaGFuZ2Vsb2c=',
          filename: 'CHANGELOG.md',
        } as unknown as Part,
        {
          type: 'file',
          mime: 'text/plain',
          url: 'data:text/plain,hello%20world',
          filename: 'hello.txt',
        } as unknown as Part,
      ];

      await manager.sendPrompt('s1', parts);

      expect(mockPromptAsync).toHaveBeenCalledTimes(1);
      const passedParts = (mockPromptAsync.mock.calls[0][0] as PromptOptions).parts as Array<{
        type: string;
        url?: string;
      }>;
      expect(passedParts[0].url).toBe('data:text/plain;base64,IyBDaGFuZ2Vsb2c=');
      expect(passedParts[1].url).toBe('data:text/plain;base64,aGVsbG8gd29ybGQ=');
    });

    it('regression: should preserve directory mime type when processing directory parts', async () => {
      const mockPromptAsync = vi.fn().mockResolvedValue(undefined);
      const mockSdk = {
        session: {
          promptAsync: mockPromptAsync,
        },
      } as unknown as SDKClient;
      const manager = new SessionManager(mockSdk);

      const parts = [
        {
          type: 'file',
          mime: 'directory',
          url: 'file:///workspace/memory',
          filename: 'memory',
        } as unknown as Part,
      ];

      await manager.sendPrompt('s1', parts);

      expect(mockPromptAsync).toHaveBeenCalledTimes(1);
      const passedParts = (mockPromptAsync.mock.calls[0][0] as PromptOptions).parts as Array<{
        type: string;
        mime: string;
        url?: string;
      }>;
      expect(passedParts[0].mime).toBe('directory');
      expect(passedParts[0].url).toBe('file:///workspace/memory');
    });

    it('regression: should preserve application/x-directory mime type when processing directory parts from backend', async () => {
      const mockPromptAsync = vi.fn().mockResolvedValue(undefined);
      const mockSdk = {
        session: {
          promptAsync: mockPromptAsync,
        },
      } as unknown as SDKClient;
      const manager = new SessionManager(mockSdk);

      const parts = [
        {
          type: 'file',
          mime: 'application/x-directory',
          url: 'file:///workspace/memory',
          filename: 'memory',
        } as unknown as Part,
      ];

      await manager.sendPrompt('s1', parts);

      expect(mockPromptAsync).toHaveBeenCalledTimes(1);
      const passedParts = (mockPromptAsync.mock.calls[0][0] as PromptOptions).parts as Array<{
        type: string;
        mime: string;
        url?: string;
      }>;
      expect(passedParts[0].mime).toBe('application/x-directory');
      expect(passedParts[0].url).toBe('file:///workspace/memory');
    });

    it('should propagate variant argument to promptAsync', async () => {
      const mockPromptAsync = vi.fn().mockResolvedValue(undefined);
      const mockSdk = {
        session: {
          promptAsync: mockPromptAsync,
        },
      } as unknown as SDKClient;
      const manager = new SessionManager(mockSdk);

      const parts = [
        {
          type: 'text',
          text: 'Hello',
        } as unknown as Part,
      ];

      await manager.sendPrompt('s1', parts, 'openai/gpt-4o', 'coder', 'high');

      expect(mockPromptAsync).toHaveBeenCalledWith({
        id: 's1',
        parts: expect.any(Array) as Part[],
        model: 'openai/gpt-4o',
        agent: 'coder',
        variant: 'high',
      });
    });

    it('should propagate variant argument to sendCommand', async () => {
      const mockCommand = vi.fn().mockResolvedValue(undefined);
      const mockSdk = {
        session: {
          command: mockCommand,
        },
      } as unknown as SDKClient;
      const manager = new SessionManager(mockSdk);

      await manager.sendCommand('s1', '/explain', 'some code', 'openai/gpt-4o', 'coder', 'medium');

      expect(mockCommand).toHaveBeenCalledWith({
        id: 's1',
        cmd: '/explain',
        args: 'some code',
        model: 'openai/gpt-4o',
        agent: 'coder',
        variant: 'medium',
      });
    });
  });

  describe('persistence integration', () => {
    let mockState: Record<string, unknown>;
    let mockMemento: Memento;
    let mockSdk: SDKClient;

    beforeEach(() => {
      mockState = {};
      mockMemento = {
        get: vi.fn((key: string, defaultValue?: unknown) => {
          return mockState[key] !== undefined ? mockState[key] : defaultValue;
        }),
        update: vi.fn((key: string, value: unknown) => {
          mockState[key] = value;
          return Promise.resolve();
        }),
        keys: vi.fn().mockReturnValue([]),
      };
      mockSdk = {
        session: {
          create: vi.fn().mockResolvedValue({
            id: 'session-new',
            title: 'Untitled',
            time: { created: Date.now(), updated: Date.now() },
          }),
          get: vi.fn().mockResolvedValue({
            id: 'session-mock',
            title: 'Untitled',
            time: { created: Date.now(), updated: Date.now() },
          }),
          update: vi.fn().mockResolvedValue(undefined),
        },
      } as unknown as SDKClient;
    });

    it('should get and set open session IDs and active session ID', async () => {
      const manager = new SessionManager(mockSdk, mockMemento);

      expect(manager.getOpenSessionIDs()).toEqual([]);
      await manager.setOpenSessionIDs(['s1', 's2']);
      expect(manager.getOpenSessionIDs()).toEqual(['s1', 's2']);

      expect(manager.activeSessionID).toBeNull();
      await manager.setActiveSessionID('s1');
      expect(manager.activeSessionID).toBe('s1');
    });

    it('should initialize activeSessionID from workspaceState on construction', () => {
      mockState['activeSessionID'] = 's2';
      const manager = new SessionManager(mockSdk, mockMemento);
      expect(manager.activeSessionID).toBe('s2');
    });

    it('should update open list and active ID on create()', async () => {
      const manager = new SessionManager(mockSdk, mockMemento);
      mockState['openSessionIDs'] = ['s1'];

      const session = await manager.create();
      expect(session.id).toBe('session-new');
      expect(manager.getOpenSessionIDs()).toEqual(['s1', 'session-new']);
      expect(manager.activeSessionID).toBe('session-new');
    });

    it('should update active ID on switch()', async () => {
      const manager = new SessionManager(mockSdk, mockMemento);
      await manager.setOpenSessionIDs(['s1', 's2']);

      await manager.switch('s2');
      expect(manager.activeSessionID).toBe('s2');
      expect(mockState['activeSessionID']).toBe('s2');
    });

    it('should remove from open list and update active ID on archive()', async () => {
      const manager = new SessionManager(mockSdk, mockMemento);
      mockState['openSessionIDs'] = ['s1', 's2'];
      mockState['activeSessionID'] = 's2';

      await manager.archive('s2');
      expect(manager.getOpenSessionIDs()).toEqual(['s1']);
      expect(manager.activeSessionID).toBe('s1');
    });

    it('should remove from open list and update active ID on close()', async () => {
      const manager = new SessionManager(mockSdk, mockMemento);
      mockState['openSessionIDs'] = ['s1', 's2'];
      mockState['activeSessionID'] = 's2';

      await manager.close('s2');
      expect(manager.getOpenSessionIDs()).toEqual(['s1']);
      expect(manager.activeSessionID).toBe('s1');
    });

    it('should clear open list and active ID on closeAll()', async () => {
      const manager = new SessionManager(mockSdk, mockMemento);
      mockState['openSessionIDs'] = ['s1', 's2'];
      mockState['activeSessionID'] = 's2';

      await manager.closeAll();
      expect(manager.getOpenSessionIDs()).toEqual([]);
      expect(manager.activeSessionID).toBeNull();
    });
  });
});
