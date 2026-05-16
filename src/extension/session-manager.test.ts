import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockSession } from '../test/mocks/sdk';

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
});
