/**
 * @file Review page component rendered inside a WebviewPanel.
 * Displays file-level diffs with expandable unified diff views.
 * Receives data via IPC from the extension host.
 * Uses vscode.setState/getState to persist data across tab switches.
 */

import type { SnapshotFileDiff } from '@opencode-ai/sdk/v2/client';
import { useEffect, useState } from 'react';
import type { ExtToWebview } from '../../shared/types';
import '../styles/review.css';
import type { ReviewScope } from '../utils/review-utils';
import { Codicon } from './Codicon';
import { FileDiffItem } from './FileDiffItem';

/** Persisted state shape for the review webview. */
interface ReviewState {
  diffs: SnapshotFileDiff[];
  title: string;
  error: string | null;
  scope: ReviewScope;
}

/** Props for the ReviewPage component. */
export interface ReviewPageProps {
  /** The unique review identifier, injected by the extension host. */
  reviewID: string;
}

/** Restores persisted review state from VS Code webview state API. */
function restoreState(): ReviewState | null {
  try {
    return window.vscode.getState() as ReviewState | null;
  } catch {
    return null;
  }
}

/**
 * Main review page component. Listens for `review:data` and `review:error` IPC messages
 * targeted at this reviewID, then renders the file diff list.
 * Persists state via vscode.setState() so data survives tab switches.
 */
export function ReviewPage({ reviewID }: ReviewPageProps) {
  // Restore persisted state if available (survives tab switches)
  const saved = restoreState();
  const [diffs, setDiffs] = useState<SnapshotFileDiff[] | null>(saved?.diffs ?? null);
  const [title, setTitle] = useState(saved?.title ?? 'Review Changes');
  const [error, setError] = useState<string | null>(saved?.error ?? null);
  const [scope, setScope] = useState<ReviewScope>(saved?.scope ?? 'session');

  useEffect(() => {
    const handler = (event: MessageEvent<ExtToWebview>) => {
      const message = event.data;
      if (message.type === 'review:data' && message.reviewID === reviewID) {
        setDiffs(message.diffs);
        setTitle(message.title);
        setError(null);
        if (message.scope) setScope(message.scope);
        try {
          window.vscode.setState({
            diffs: message.diffs,
            title: message.title,
            error: null,
            scope: message.scope ?? 'session',
          });
        } catch {
          // setState may fail in test environments
        }
      } else if (message.type === 'review:error' && message.reviewID === reviewID) {
        setError(message.message);
        setDiffs([]);
        // Read current persisted state to avoid stale closure over scope/title
        const current = restoreState();
        try {
          window.vscode.setState({
            diffs: [],
            title: current?.title ?? 'Review Changes',
            error: message.message,
            scope: current?.scope ?? 'session',
          });
        } catch {
          // setState may fail in test environments
        }
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [reviewID]);

  const handleClose = () => {
    window.vscode.postMessage({ type: 'review:close', reviewID });
  };

  const totalAdditions = diffs?.reduce((sum, d) => sum + d.additions, 0) ?? 0;
  const totalDeletions = diffs?.reduce((sum, d) => sum + d.deletions, 0) ?? 0;

  return (
    <div className="review-container">
      <div className="review-header">
        <div className="review-header-left">
          <span className="review-title">{title}</span>
          <span className="review-chip">{scope === 'turn' ? 'For turn' : 'For session'}</span>
        </div>
        <button
          className="review-close-btn"
          onClick={handleClose}
          data-custom-title="Close"
          aria-label="Close review"
        >
          <Codicon name="close" />
        </button>
      </div>

      <div className="review-file-list">
        {diffs === null && !error && (
          <div className="review-loading">
            <span>Loading review data...</span>
          </div>
        )}

        {error && (
          <div className="review-error">
            <Codicon name="error" />
            <span>{error}</span>
          </div>
        )}

        {diffs !== null && !error && diffs.length === 0 && (
          <div className="review-empty">
            <span>No file changes to review.</span>
          </div>
        )}

        {diffs !== null && diffs.length > 0 && (
          <>
            <div className="review-summary">
              <span className="review-summary-count">{diffs.length} files changed</span>
              <span className="review-summary-stats">
                <span className="review-stat-added">+{totalAdditions}</span>
                <span className="review-stat-removed">-{totalDeletions}</span>
              </span>
            </div>
            {diffs.map((diff, idx) => (
              <FileDiffItem key={diff.file ?? idx} diff={diff} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
