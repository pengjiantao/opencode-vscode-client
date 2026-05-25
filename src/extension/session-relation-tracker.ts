/**
 * @file Helper class to manage parent-child session relationships and titles.
 * Used to resolve root parent session IDs for sub-agents and prevent memory leaks.
 */

/**
 * Tracks the parent-child relationships and titles of active sessions.
 * Helps map sub-agent requests back to their respective primary parent session.
 */
export class SessionRelationTracker {
  /** Internal mapping of child session ID to parent session ID. */
  public readonly parentMap = new Map<string, string>();

  /** Internal mapping of session ID to session title. */
  public readonly titleMap = new Map<string, string>();

  /**
   * Recursively resolves the root parent session ID for a session.
   * Traverses up the parent chain until a session with no parent is found.
   *
   * @param sessionID The child session ID.
   * @returns The root parent session ID.
   */
  public getRootParentID(sessionID: string): string {
    let currentID = sessionID;
    const visited = new Set<string>();
    while (this.parentMap.has(currentID)) {
      if (visited.has(currentID)) {
        break;
      }
      visited.add(currentID);
      const parentID = this.parentMap.get(currentID);
      if (!parentID) {
        break;
      }
      currentID = parentID;
    }
    return currentID;
  }

  /**
   * Cleans up mapped states for a session and any of its children.
   * Called when a session is closed or archived to prevent memory leaks.
   *
   * @param sessionID The session ID to clean up.
   */
  public clean(sessionID: string): void {
    const toRemove = new Set<string>([sessionID]);
    let added = true;
    while (added) {
      added = false;
      for (const [childID, parentID] of this.parentMap.entries()) {
        if (toRemove.has(parentID) && !toRemove.has(childID)) {
          toRemove.add(childID);
          added = true;
        }
      }
    }

    for (const id of toRemove) {
      this.parentMap.delete(id);
      this.titleMap.delete(id);
    }
  }

  /**
   * Clears all session mappings.
   * Used to reset the tracking state when all sessions are closed.
   */
  public clear(): void {
    this.parentMap.clear();
    this.titleMap.clear();
  }
}
