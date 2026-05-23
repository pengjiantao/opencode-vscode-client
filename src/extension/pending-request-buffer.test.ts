/**
 * @file Unit tests for PendingRequestBuffer class.
 */

import type { PermissionRequest, QuestionRequest } from '@opencode-ai/sdk/v2/client';
import { describe, expect, it } from 'vitest';
import { PendingRequestBuffer } from './pending-request-buffer';

describe('PendingRequestBuffer', () => {
  it('adds and retrieves pending permissions', () => {
    const buffer = new PendingRequestBuffer();
    const perm1: PermissionRequest = {
      id: 'perm-1',
      sessionID: 'session-1',
      permission: 'read_file',
      patterns: [],
      metadata: { filePath: '/src/file1.ts' },
      always: [],
    };
    const perm2: PermissionRequest = {
      id: 'perm-2',
      sessionID: 'session-2',
      permission: 'write_file',
      patterns: [],
      metadata: { filePath: '/src/file2.ts' },
      always: [],
    };

    buffer.addPermission(perm1);
    buffer.addPermission(perm2);

    const s1 = buffer.getBySession('session-1');
    expect(s1.permissions).toHaveLength(1);
    expect(s1.permissions[0]).toEqual(perm1);
    expect(s1.questions).toHaveLength(0);

    const s2 = buffer.getBySession('session-2');
    expect(s2.permissions).toHaveLength(1);
    expect(s2.permissions[0]).toEqual(perm2);

    // Test deletion
    buffer.removePermission('perm-1');
    const s1After = buffer.getBySession('session-1');
    expect(s1After.permissions).toHaveLength(0);
  });

  it('adds and retrieves pending questions', () => {
    const buffer = new PendingRequestBuffer();
    const q1: QuestionRequest = {
      id: 'q-1',
      sessionID: 'session-1',
      questions: [],
    };
    const q2: QuestionRequest = {
      id: 'q-2',
      sessionID: 'session-2',
      questions: [],
    };

    buffer.addQuestion(q1);
    buffer.addQuestion(q2);

    const s1 = buffer.getBySession('session-1');
    expect(s1.questions).toHaveLength(1);
    expect(s1.questions[0]).toEqual(q1);
    expect(s1.permissions).toHaveLength(0);

    // Test deletion
    buffer.removeQuestion('q-1');
    const s1After = buffer.getBySession('session-1');
    expect(s1After.questions).toHaveLength(0);
  });

  it('removes requests by session ID', () => {
    const buffer = new PendingRequestBuffer();
    const perm: PermissionRequest = {
      id: 'perm-1',
      sessionID: 'session-1',
      permission: 'read_file',
      patterns: [],
      metadata: {},
      always: [],
    };
    const q: QuestionRequest = {
      id: 'q-1',
      sessionID: 'session-1',
      questions: [],
    };

    buffer.addPermission(perm);
    buffer.addQuestion(q);

    buffer.removeBySession('session-1');
    const s1 = buffer.getBySession('session-1');
    expect(s1.permissions).toHaveLength(0);
    expect(s1.questions).toHaveLength(0);
  });

  it('clears all requests', () => {
    const buffer = new PendingRequestBuffer();
    const perm: PermissionRequest = {
      id: 'perm-1',
      sessionID: 'session-1',
      permission: 'read_file',
      patterns: [],
      metadata: {},
      always: [],
    };
    const q: QuestionRequest = {
      id: 'q-1',
      sessionID: 'session-2',
      questions: [],
    };

    buffer.addPermission(perm);
    buffer.addQuestion(q);

    buffer.clear();
    expect(buffer.getBySession('session-1').permissions).toHaveLength(0);
    expect(buffer.getBySession('session-2').questions).toHaveLength(0);
  });
});
