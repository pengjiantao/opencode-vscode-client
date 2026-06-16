/**
 * @file Utilities for review panel identification and scope detection.
 */

/** The scope of a review — either a single prompt turn or an entire session. */
export type ReviewScope = 'turn' | 'session';

/** Metadata passed when requesting a review panel. */
export interface ReviewRequestMeta {
  sessionID: string;
  messageID?: string;
  scope: ReviewScope;
}

/**
 * Generates a stable reviewID for a review panel.
 * Format: `{sessionID}:{messageID}` for turn-scope reviews, or
 *         `{sessionID}:{scope}` for session-scope reviews.
 *
 * The ID is intentionally deterministic for a given (session, scope, messageID)
 * tuple so that repeated clicks on the same "summary" button map to the same
 * review tab. The extension-side {@link ReviewPanelManager} uses this ID as a
 * dedup key to reveal the existing panel rather than opening duplicates.
 *
 * @param sessionID The session ID.
 * @param scope Whether this is a turn-level or session-level review.
 * @param messageID Optional message ID (used for turn-level reviews).
 * @returns A stable review identifier string.
 */
export function createReviewID(sessionID: string, scope: ReviewScope, messageID?: string): string {
  const key = scope === 'turn' && messageID ? messageID : scope;
  return `${sessionID}:${key}`;
}
