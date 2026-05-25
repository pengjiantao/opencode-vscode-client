/**
 * @file Unit tests for SessionRelationTracker.
 * Verifies child-to-parent session relationship tracking, recursive root resolution,
 * and memory cleanup/garbage collection.
 */

import { describe, expect, it } from 'vitest';
import { SessionRelationTracker } from './session-relation-tracker';

describe('SessionRelationTracker', () => {
  it('returns the same sessionID if there is no parent mapping', () => {
    const tracker = new SessionRelationTracker();
    tracker.titleMap.set('session-1', 'Main Session');

    expect(tracker.getRootParentID('session-1')).toBe('session-1');
  });

  it('resolves the direct parent session ID', () => {
    const tracker = new SessionRelationTracker();
    tracker.titleMap.set('parent-1', 'Main Session');
    tracker.titleMap.set('child-1', 'Subtask');
    tracker.parentMap.set('child-1', 'parent-1');

    expect(tracker.getRootParentID('child-1')).toBe('parent-1');
  });

  it('recursively resolves the root parent session ID through nested children', () => {
    const tracker = new SessionRelationTracker();
    tracker.titleMap.set('parent-1', 'Root');
    tracker.titleMap.set('child-1', 'Sub 1');
    tracker.titleMap.set('child-2', 'Sub 2');

    tracker.parentMap.set('child-1', 'parent-1');
    tracker.parentMap.set('child-2', 'child-1');

    expect(tracker.getRootParentID('child-2')).toBe('parent-1');
  });

  it('handles cyclic dependencies gracefully by breaking the loop', () => {
    const tracker = new SessionRelationTracker();
    tracker.parentMap.set('session-a', 'session-b');
    tracker.parentMap.set('session-b', 'session-a');

    // Expected to break the loop and return the last visited node in the cycle
    expect(tracker.getRootParentID('session-a')).toBe('session-a');
  });

  it('cleans up entries for a session and all descendants recursively when clean is called', () => {
    const tracker = new SessionRelationTracker();
    tracker.titleMap.set('parent-1', 'Root');
    tracker.titleMap.set('child-1', 'Sub 1');
    tracker.titleMap.set('child-2', 'Sub 2');
    tracker.parentMap.set('child-1', 'parent-1');
    tracker.parentMap.set('child-2', 'child-1');

    tracker.clean('parent-1');

    expect(tracker.titleMap.has('parent-1')).toBe(false);
    expect(tracker.parentMap.has('child-1')).toBe(false);
    expect(tracker.titleMap.has('child-1')).toBe(false);
    expect(tracker.parentMap.has('child-2')).toBe(false);
    expect(tracker.titleMap.has('child-2')).toBe(false);
  });

  it('clears all session mappings on clear', () => {
    const tracker = new SessionRelationTracker();
    tracker.titleMap.set('session-1', 'Main');
    tracker.parentMap.set('session-2', 'session-1');

    tracker.clear();

    expect(tracker.titleMap.size).toBe(0);
    expect(tracker.parentMap.size).toBe(0);
  });
});
