/**
 * @file Manages WebviewPanel instances for review tabs.
 * Creates, tracks, and disposes review panels. Each panel gets a unique viewType
 * allowing multiple review tabs to be open simultaneously.
 */

import type { SnapshotFileDiff } from '@opencode-ai/sdk/v2/client';
import { type ExtensionContext, Uri, ViewColumn, type WebviewPanel, window } from 'vscode';
import { IPCBridge } from './ipc';
import type { SDKClient } from './sdk-client';
import { getWebviewHtml } from './webview-html';

/** Metadata associated with a review panel. */
interface ReviewPanelMeta {
  panel: WebviewPanel;
  ipc: IPCBridge;
  sessionID: string;
  messageID?: string;
}

/**
 * Creates and manages review WebviewPanel instances.
 * Each review gets its own tab with a unique viewType for multi-tab support.
 */
export class ReviewPanelManager {
  private panels = new Map<string, ReviewPanelMeta>();
  private mainIpc: IPCBridge | null = null;

  constructor(
    private readonly context: ExtensionContext,
    private readonly sdk: SDKClient,
  ) {}

  /** Sets the main sidebar IPC bridge, used to send review:closed notifications. */
  setMainIpc(ipc: IPCBridge): void {
    this.mainIpc = ipc;
  }

  /**
   * Opens a new review panel or reveals an existing one for the given reviewID.
   * If diffs are provided directly, uses them. Otherwise fetches from the backend.
   *
   * @param reviewID Unique identifier for this review instance.
   * @param sessionID The session to fetch diffs for.
   * @param messageID Optional message ID to scope diffs to a single turn.
   * @param title The title to display on the review tab.
   * @param diffs Optional pre-fetched diffs (e.g. per-turn diffs from webview store).
   * @param scope Whether this is a turn-level or session-level review.
   */
  async open(
    reviewID: string,
    sessionID: string,
    messageID: string | undefined,
    title: string,
    diffs?: SnapshotFileDiff[],
    scope?: 'turn' | 'session',
  ): Promise<void> {
    const existing = this.panels.get(reviewID);
    if (existing) {
      existing.panel.reveal(existing.panel.viewColumn);
      return;
    }

    const viewType = `opencode-review.${reviewID}`;
    const panel = window.createWebviewPanel(viewType, title, ViewColumn.One, {
      enableScripts: true,
      localResourceRoots: [Uri.joinPath(this.context.extensionUri, 'dist')],
    });

    const ipc = new IPCBridge();
    ipc.setPanel(panel);

    panel.webview.html = getWebviewHtml(
      panel.webview,
      this.context.extensionPath,
      `reviewID: "${reviewID}"`,
    );

    this.panels.set(reviewID, { panel, ipc, sessionID, messageID });

    // Handle panel close from webview
    ipc.on('review:close', (msg) => {
      const { reviewID: closeID } = msg as { reviewID: string };
      const meta = this.panels.get(closeID);
      if (meta) {
        meta.panel.dispose();
      }
    });

    panel.onDidDispose(() => {
      this.panels.delete(reviewID);
      // Notify the sidebar webview that this review panel was closed
      this.mainIpc?.send({ type: 'review:closed', reviewID });
    });

    // Use diffs directly if provided, otherwise fetch from backend
    try {
      let result = diffs;
      if (!result) {
        result = await this.sdk.session.diff(sessionID, messageID);
      }
      ipc.send({ type: 'review:data', reviewID, diffs: result, title, scope });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ipc.send({ type: 'review:error', reviewID, message });
    }
  }

  /**
   * Disposes all tracked review panels. Called during extension deactivation.
   */
  disposeAll(): void {
    for (const [, meta] of this.panels) {
      meta.panel.dispose();
    }
    this.panels.clear();
  }
}
