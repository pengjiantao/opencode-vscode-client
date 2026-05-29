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
 * Generates a unique reviewID for a review panel.
 * Format: `{sessionID}:{scope}:{timestamp}`
 *
 * @param sessionID The session ID.
 * @param scope Whether this is a turn-level or session-level review.
 * @param messageID Optional message ID (used for turn-level reviews).
 * @returns A unique review identifier string.
 */
export function createReviewID(sessionID: string, scope: ReviewScope, messageID?: string): string {
  const key = scope === 'turn' && messageID ? messageID : scope;
  return `${sessionID}:${key}:${Date.now()}`;
}
