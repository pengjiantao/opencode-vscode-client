/**
 * @file Unit tests for sessionStore (Zustand) — sessions, messages, parts, and status operations.
 */

import type { UserMessage } from '@opencode-ai/sdk/v2/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMockSession, createMockTextPart, createMockUserMessage } from '../../test/mocks/sdk';
import { useSessionStore } from './sessionStore';

describe('sessionStore', () => {
  beforeEach(() => {
    useSessionStore.setState({
      sessions: [],
      activeSessionID: null,
      messages: {},
      parts: {},
      sessionStatus: {},
    });
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
});
