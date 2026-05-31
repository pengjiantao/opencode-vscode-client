/**
 * @file Unit tests for sessionStore (Zustand) — sessions, messages, parts, and status operations.
 */

import type { UserMessage } from '@opencode-ai/sdk/v2/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockSession, createMockTextPart, createMockUserMessage } from '../../test/mocks/sdk';
import { useSessionStore } from './sessionStore';

// Mock window.vscode for fetchChildSession IPC calls
Object.defineProperty(window, 'vscode', {
  value: { postMessage: vi.fn(), getState: vi.fn(), setState: vi.fn() },
  writable: true,
});

describe('sessionStore', () => {
  beforeEach(() => {
    useSessionStore.setState({
      sessions: [],
      activeSessionID: null,
      messages: {},
      parts: {},
      sessionStatus: {},
      loadedChildSessions: new Set(),
    });
    vi.mocked(window.vscode.postMessage).mockClear();
  });

  describe('setActiveSession', () => {
    it('sets the active session ID', () => {
      useSessionStore.getState().setActiveSession('session-1');
      expect(useSessionStore.getState().activeSessionID).toBe('session-1');
    });
  });

  describe('sessions', () => {
    it('adds a session', () => {
      const session = createMockSession();
      useSessionStore.getState().addSession(session);

      expect(useSessionStore.getState().sessions).toHaveLength(1);
      expect(useSessionStore.getState().sessions[0]).toEqual(session);
    });

    it('does not add duplicate sessions', () => {
      const session = createMockSession();
      useSessionStore.getState().addSession(session);
      useSessionStore.getState().addSession(session);

      expect(useSessionStore.getState().sessions).toHaveLength(1);
    });

    it('removes a session', () => {
      const session = createMockSession();
      useSessionStore.getState().addSession(session);
      useSessionStore.getState().removeSession(session.id);

      expect(useSessionStore.getState().sessions).toHaveLength(0);
    });

    it('updates a session', () => {
      const session = createMockSession();
      const updated = { ...session, title: 'Updated Title' };
      useSessionStore.getState().addSession(session);
      useSessionStore.getState().updateSession(updated);

      expect(useSessionStore.getState().sessions[0].title).toBe('Updated Title');
    });

    it('sets all sessions', () => {
      const sessions = [createMockSession(), createMockSession({ id: 'session-2' })];
      useSessionStore.getState().setSessions(sessions);

      expect(useSessionStore.getState().sessions).toHaveLength(2);
    });
  });

  describe('messages', () => {
    it('adds a message to a session', () => {
      const message = createMockUserMessage();
      useSessionStore.getState().addMessage('session-1', message);

      expect(useSessionStore.getState().messages['session-1']).toHaveLength(1);
      expect(useSessionStore.getState().messages['session-1'][0]).toEqual(message);
    });

    it('updates a message', () => {
      const message = createMockUserMessage();
      useSessionStore.getState().addMessage('session-1', message);

      const updated = { ...message, agent: 'updated-agent' as const };
      useSessionStore.getState().updateMessage(updated);

      const stored = useSessionStore.getState().messages['session-1'][0] as UserMessage;
      expect(stored.agent).toBe('updated-agent');
    });

    it('sets session messages and parts in bulk', () => {
      const message = createMockUserMessage();
      const part = createMockTextPart();
      part.messageID = message.id;

      useSessionStore.getState().setSessionMessagesAndParts('session-1', [message], [part]);

      expect(useSessionStore.getState().messages['session-1']).toHaveLength(1);
      expect(useSessionStore.getState().messages['session-1'][0]).toEqual(message);
      expect(useSessionStore.getState().parts[message.id]).toHaveLength(1);
      expect(useSessionStore.getState().parts[message.id][0]).toEqual(part);
    });

    it('sets session messages, parts, and status in bulk', () => {
      const message = createMockUserMessage();
      const part = createMockTextPart();
      part.messageID = message.id;
      const status = { type: 'busy' as const };

      useSessionStore.getState().setSessionMessagesAndParts('session-1', [message], [part], status);

      expect(useSessionStore.getState().messages['session-1']).toHaveLength(1);
      expect(useSessionStore.getState().messages['session-1'][0]).toEqual(message);
      expect(useSessionStore.getState().parts[message.id]).toHaveLength(1);
      expect(useSessionStore.getState().parts[message.id][0]).toEqual(part);
      expect(useSessionStore.getState().sessionStatus['session-1']).toEqual(status);
    });
  });

  describe('removeMessagesFrom', () => {
    it('removes messages at or after the given messageID and their parts', () => {
      const msg1 = createMockUserMessage();
      const msg2 = createMockUserMessage();
      const msg3 = createMockUserMessage();
      msg1.id = 'msg-001';
      msg2.id = 'msg-002';
      msg3.id = 'msg-003';

      const part1 = createMockTextPart();
      part1.messageID = msg1.id;
      const part2 = createMockTextPart();
      part2.messageID = msg2.id;

      useSessionStore
        .getState()
        .setSessionMessagesAndParts('session-1', [msg1, msg2, msg3], [part1, part2]);

      useSessionStore.getState().removeMessagesFrom('session-1', 'msg-002');

      const remaining = useSessionStore.getState().messages['session-1'];
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('msg-001');
      expect(useSessionStore.getState().parts['msg-001']).toBeDefined();
      expect(useSessionStore.getState().parts['msg-002']).toBeUndefined();
      expect(useSessionStore.getState().parts['msg-003']).toBeUndefined();
    });

    it('does nothing if no messages match', () => {
      const msg1 = createMockUserMessage();
      msg1.id = 'msg-001';
      useSessionStore.getState().setSessionMessagesAndParts('session-1', [msg1], []);

      useSessionStore.getState().removeMessagesFrom('session-1', 'msg-999');

      expect(useSessionStore.getState().messages['session-1']).toHaveLength(1);
    });
  });

  describe('removePart', () => {
    it('removes a specific part from a message', () => {
      const part1 = createMockTextPart('Part 1');
      part1.id = 'part-001';
      part1.messageID = 'msg-1';
      const part2 = createMockTextPart('Part 2');
      part2.id = 'part-002';
      part2.messageID = 'msg-1';

      useSessionStore.setState({
        parts: { 'msg-1': [part1, part2] },
      });

      useSessionStore.getState().removePart('msg-1', 'part-001');

      expect(useSessionStore.getState().parts['msg-1']).toHaveLength(1);
      expect(useSessionStore.getState().parts['msg-1'][0].id).toBe('part-002');
    });

    it('does nothing if messageID has no parts', () => {
      useSessionStore.setState({ parts: {} });

      useSessionStore.getState().removePart('msg-nonexistent', 'part-1');

      expect(useSessionStore.getState().parts['msg-nonexistent']).toBeUndefined();
    });
  });

  describe('setSessionStatus', () => {
    it('sets session status', () => {
      const status = { type: 'busy' as const };
      useSessionStore.getState().setSessionStatus('session-1', status);

      expect(useSessionStore.getState().sessionStatus['session-1']).toEqual(status);
    });
  });

  describe('setPendingRequests', () => {
    it('overwrites pending requests for a specific session without affecting other sessions', () => {
      const perm1 = {
        id: 'perm-1',
        sessionID: 'session-1',
        permission: 'read_file',
        patterns: [],
        metadata: {},
        always: [],
      };
      const perm2 = {
        id: 'perm-2',
        sessionID: 'session-2',
        permission: 'write_file',
        patterns: [],
        metadata: {},
        always: [],
      };
      const q1 = {
        id: 'q-1',
        sessionID: 'session-1',
        questions: [],
      };
      const q2 = {
        id: 'q-2',
        sessionID: 'session-2',
        questions: [],
      };

      useSessionStore.setState({
        pendingPermissions: [perm1, perm2],
        pendingQuestions: [q1, q2],
      });

      // Synchronize session-1 with empty pending lists
      useSessionStore.getState().setPendingRequests('session-1', [], []);

      expect(useSessionStore.getState().pendingPermissions).toEqual([perm2]);
      expect(useSessionStore.getState().pendingQuestions).toEqual([q2]);

      // Synchronize session-1 with new pending list
      const newPerm = { ...perm1, id: 'perm-new' };
      const newQ = { ...q1, id: 'q-new' };
      useSessionStore.getState().setPendingRequests('session-1', [newPerm], [newQ]);

      expect(useSessionStore.getState().pendingPermissions).toEqual([perm2, newPerm]);
      expect(useSessionStore.getState().pendingQuestions).toEqual([q2, newQ]);
    });
  });

  describe('fetchChildSession', () => {
    it('sends IPC request and marks session as loaded', () => {
      useSessionStore.getState().fetchChildSession('child-1');

      expect(useSessionStore.getState().loadedChildSessions.has('child-1')).toBe(true);
      expect(window.vscode.postMessage).toHaveBeenCalledWith({
        type: 'session:load-child-messages',
        sessionID: 'child-1',
      });
    });

    it('does not send duplicate IPC for already loaded session', () => {
      useSessionStore.getState().fetchChildSession('child-1');
      useSessionStore.getState().fetchChildSession('child-1');

      expect(window.vscode.postMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('mergeChildSessionData', () => {
    it('merges child session messages and parts into the store', () => {
      const msg = createMockUserMessage();
      msg.id = 'child-msg-1';
      const part = createMockTextPart('child output');
      part.messageID = 'child-msg-1';

      useSessionStore.getState().mergeChildSessionData('child-session', [msg], [part]);

      expect(useSessionStore.getState().messages['child-session']).toHaveLength(1);
      expect(useSessionStore.getState().messages['child-session'][0].id).toBe('child-msg-1');
      expect(useSessionStore.getState().parts['child-msg-1']).toHaveLength(1);
    });

    it('does not affect parent session messages', () => {
      const parentMsg = createMockUserMessage();
      parentMsg.id = 'parent-msg-1';
      useSessionStore.getState().addMessage('parent-session', parentMsg);

      const childMsg = createMockUserMessage();
      childMsg.id = 'child-msg-1';
      useSessionStore.getState().mergeChildSessionData('child-session', [childMsg], []);

      expect(useSessionStore.getState().messages['parent-session']).toHaveLength(1);
      expect(useSessionStore.getState().messages['child-session']).toHaveLength(1);
    });

    it('drops orphan parts whose messageID is not in the messages array', () => {
      const msg = createMockUserMessage();
      msg.id = 'child-msg-1';

      const orphanPart = createMockTextPart('orphan');
      orphanPart.messageID = 'non-existent-msg';

      useSessionStore.getState().mergeChildSessionData('child-session', [msg], [orphanPart]);

      expect(useSessionStore.getState().parts['non-existent-msg']).toBeUndefined();
      expect(useSessionStore.getState().parts['child-msg-1']).toHaveLength(0);
    });
  });

  describe('clearChildSessions', () => {
    it('resets loaded child sessions tracking', () => {
      useSessionStore.getState().fetchChildSession('child-1');
      useSessionStore.getState().fetchChildSession('child-2');
      expect(useSessionStore.getState().loadedChildSessions.size).toBe(2);

      useSessionStore.getState().clearChildSessions();
      expect(useSessionStore.getState().loadedChildSessions.size).toBe(0);
    });
  });
});
