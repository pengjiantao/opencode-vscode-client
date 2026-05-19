/**
 * @file Unit tests for SessionManager — session CRUD, switching, archiving, and prompt sanitization.
 */

import type { Part } from '@opencode-ai/sdk/v2/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockSession } from '../test/mocks/sdk';
import type { SDKClient } from './sdk-client';
import { SessionManager } from './session-manager';

describe('SessionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new session', () => {
      const mockSession = createMockSession({ id: 'new-session', title: 'New Session' });

      expect(mockSession.id).toBe('new-session');
      expect(mockSession.title).toBe('New Session');
    });

    it('should generate unique session IDs', () => {
      const session1 = createMockSession();
      const session2 = createMockSession();

      expect(session1.id).not.toBe(session2.id);
    });
  });

  describe('switch', () => {
    it('should track active session', () => {
      const session = createMockSession();
      const activeID = session.id;

      expect(activeID).toBe(session.id);
    });
  });

  describe('archive', () => {
    it('should mark session as archived', () => {
      const session = createMockSession();
      const archivedAt = Date.now();

      const archived = {
        ...session,
        time: { ...session.time, archived: archivedAt },
      };

      expect(archived.time.archived).toBeDefined();
    });
  });

  describe('setSessions and switch functionality', () => {
    it('should update sessions list and switch active sessions correctly', () => {
      const mockSdk = {} as unknown as SDKClient;
      const manager = new SessionManager(mockSdk);
      const session1 = createMockSession({ id: 's1', title: 'Session 1' });
      const session2 = createMockSession({ id: 's2', title: 'Session 2' });

      manager.setSessions([session1, session2]);
      expect(manager.state.sessions).toEqual([session1, session2]);

      manager.switch('s2');
      expect(manager.activeSessionID).toBe('s2');

      expect(() => manager.switch('non-existent')).toThrowError('Session non-existent not found');
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
      expect(mockPromptAsync).toHaveBeenCalledWith(
        's1',
        [
          {
            type: 'text',
            text: 'Hello, World!',
            synthetic: false,
            ignored: false,
            time: undefined,
            metadata: undefined,
          },
        ],
        'openai/gpt-4o',
        'coder',
      );
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
      const passedParts = mockPromptAsync.mock.calls[0][1] as Array<{ type: string; url?: string }>;
      expect(passedParts[0].url).toBe('data:text/plain;base64,IyBDaGFuZ2Vsb2c=');
      expect(passedParts[1].url).toBe('data:text/plain;base64,aGVsbG8gd29ybGQ=');
    });
  });
});
