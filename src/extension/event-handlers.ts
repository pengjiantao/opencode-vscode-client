/**
 * @file SSE event subscriber setup and processing.
 * Listens to SDK client events, maps sub-agent requests, and communicates updates to webview/status bar.
 */

import type { PermissionRequest, QuestionRequest, SessionStatus } from '@opencode-ai/sdk/v2/client';
import type { IPCBridge } from './ipc';
import type { PendingRequestBuffer } from './pending-request-buffer';
import type { SDKClient } from './sdk-client';
import type { SessionRelationTracker } from './session-relation-tracker';
import type { StatusBarManager } from './status-bar';
import type { ExtToWebview } from './types';

/** Options required to register the SDK client event handlers. */
interface EventHandlersRegistrationOptions {
  /** The SDK client instance subscribing to server SSE events. */
  sdk: SDKClient;
  /** IPC bridge to send received events to the webview. */
  ipc: IPCBridge;
  /** Buffer storing pending permissions and questions in the extension. */
  pendingBuffer: PendingRequestBuffer;
  /** Global map tracking the status of each session. */
  sessionStatuses: Map<string, SessionStatus>;
  /** Visual status bar item manager. */
  statusBarManager: StatusBarManager;
  /** Tracker for sub-agent parent session relations and titles. */
  relationTracker: SessionRelationTracker;
  /** Callback to sync LSP/MCP metadata back to the webview. */
  syncMetadata: () => void;
}

/**
 * Subscribes to backend SSE events and routes them to the webview.
 * Intercepts sub-agent permissions/questions to map them to the root parent,
 * and filters child session created events to keep the tab list clean.
 *
 * @param options Registration dependencies.
 * @returns A cleanup function to unsubscribe from the events.
 */
export function registerEventHandlers({
  sdk,
  ipc,
  pendingBuffer,
  sessionStatuses,
  statusBarManager,
  relationTracker,
  syncMetadata,
}: EventHandlersRegistrationOptions): () => void {
  const unsubscribeEvents = sdk.subscribeEvents((event: unknown) => {
    const evt = event as {
      type?: string;
      properties?: {
        sessionID?: string;
        status?: SessionStatus;
        info?: { id?: string; title: string; parentID?: string };
      };
    };

    // Keep tracking parent-child session relations and titles as they are created/updated
    if (evt.type === 'session.created' || evt.type === 'session.updated') {
      const sessionInfo = evt.properties?.info;
      if (sessionInfo && sessionInfo.id) {
        relationTracker.titleMap.set(sessionInfo.id, sessionInfo.title);
        if (sessionInfo.parentID) {
          relationTracker.parentMap.set(sessionInfo.id, sessionInfo.parentID);
        }
      }
    }

    if (evt.type === 'permission.asked') {
      const req = evt.properties as unknown as PermissionRequest & { subagentTitle?: string };
      if (req && req.sessionID) {
        const rootParentID = relationTracker.getRootParentID(req.sessionID);
        // Redirect sub-agent permission requests to the parent session
        if (rootParentID !== req.sessionID) {
          const childTitle = relationTracker.titleMap.get(req.sessionID) || 'Sub-agent';
          req.sessionID = rootParentID;
          req.subagentTitle = childTitle;
        }
      }
      pendingBuffer.addPermission(req);
    } else if (evt.type === 'permission.replied') {
      const permID = (evt.properties as unknown as { requestID: string })?.requestID;
      if (permID) {
        pendingBuffer.removePermission(permID);
      }
    } else if (evt.type === 'question.asked') {
      const req = evt.properties as unknown as QuestionRequest & { subagentTitle?: string };
      if (req && req.sessionID) {
        const rootParentID = relationTracker.getRootParentID(req.sessionID);
        // Redirect sub-agent question requests to the parent session
        if (rootParentID !== req.sessionID) {
          const childTitle = relationTracker.titleMap.get(req.sessionID) || 'Sub-agent';
          req.sessionID = rootParentID;
          req.subagentTitle = childTitle;
        }
      }
      pendingBuffer.addQuestion(req);
    } else if (evt.type === 'question.replied' || evt.type === 'question.rejected') {
      const reqID = (evt.properties as unknown as { requestID: string })?.requestID;
      if (reqID) {
        pendingBuffer.removeQuestion(reqID);
      }
    }

    // Forward SSE events to webview, but block child session creation
    // to prevent empty, switch-erroring tabs from rendering in the UI
    const sessionInfo = evt.properties?.info;
    const isChildSessionCreated = evt.type === 'session.created' && sessionInfo?.parentID;
    if (!isChildSessionCreated) {
      ipc.send({ type: 'event:received', event } as ExtToWebview);
    }

    if (evt.type === 'session.status' && evt.properties?.sessionID && evt.properties?.status) {
      sessionStatuses.set(evt.properties.sessionID, evt.properties.status);
      statusBarManager.update();
    } else if (evt.type === 'session.deleted' && evt.properties?.info?.id) {
      sessionStatuses.delete(evt.properties.info.id);
      relationTracker.clean(evt.properties.info.id);
      statusBarManager.update();
    } else if (evt.type === 'lsp.updated') {
      void syncMetadata();
    }
  });

  return unsubscribeEvents;
}
