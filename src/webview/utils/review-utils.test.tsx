/**
 * @file Unit tests for createReviewID.
 * Verifies that the ID is stable for the same (session, scope, messageID) tuple
 * — a prerequisite for the extension-side ReviewPanelManager to dedupe repeated
 * clicks on the same "summary" button and reveal the existing review tab.
 */

import { describe, expect, it } from 'vitest';
import { createReviewID } from './review-utils';

describe('createReviewID', () => {
  it('returns a stable ID for the same turn-scope arguments', () => {
    const sessionID = 'sess-1';
    const messageID = 'msg-1';
    const a = createReviewID(sessionID, 'turn', messageID);
    const b = createReviewID(sessionID, 'turn', messageID);
    expect(a).toBe(b);
    expect(a).toBe(`${sessionID}:${messageID}`);
  });

  it('returns a stable ID for the same session-scope arguments', () => {
    const sessionID = 'sess-1';
    const a = createReviewID(sessionID, 'session');
    const b = createReviewID(sessionID, 'session');
    expect(a).toBe(b);
    expect(a).toBe(`${sessionID}:session`);
  });

  it('produces different IDs for different messages of the same session (turn scope)', () => {
    const sessionID = 'sess-1';
    const a = createReviewID(sessionID, 'turn', 'msg-1');
    const b = createReviewID(sessionID, 'turn', 'msg-2');
    expect(a).not.toBe(b);
  });

  it('produces different IDs for different sessions with the same message', () => {
    const messageID = 'msg-1';
    const a = createReviewID('sess-1', 'turn', messageID);
    const b = createReviewID('sess-2', 'turn', messageID);
    expect(a).not.toBe(b);
  });

  it('produces a session-scope ID that differs from any turn-scope ID of the same session', () => {
    const sessionID = 'sess-1';
    const turn = createReviewID(sessionID, 'turn', 'msg-1');
    const session = createReviewID(sessionID, 'session');
    expect(turn).not.toBe(session);
  });

  it('falls back to scope when turn-scope is requested without a messageID', () => {
    const sessionID = 'sess-1';
    const id = createReviewID(sessionID, 'turn');
    expect(id).toBe(`${sessionID}:turn`);
  });

  it('does not include a timestamp suffix (regression: previously appended Date.now())', () => {
    // If a timestamp were appended, two calls separated by at least 1ms would
    // produce different IDs — which is exactly the bug we are guarding against.
    const id = createReviewID('sess-1', 'session');
    expect(id).not.toMatch(/:\d+$/);
    // Also explicit: a fresh call in the same tick must match.
    expect(createReviewID('sess-1', 'session')).toBe(id);
  });
});
