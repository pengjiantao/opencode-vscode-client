/**
 * @file Zustand store managing all session, message, part, and permission state.
 * Central state hub for the webview React application.
 */

import type {
  Message,
  Part,
  PermissionRequest,
  QuestionRequest,
  Session,
  SessionStatus,
  SnapshotFileDiff,
} from '@opencode-ai/sdk/v2/client';
import { create } from 'zustand';
import type { CommandInfo, LspServerInfo, McpServerInfo, SkillInfo } from '../../shared/types';

/** Full shape of the session store's state and actions. */
export interface SessionStore {
  /** All known sessions (open/running). */
  sessions: Session[];
  /** Currently active session ID. */
  activeSessionID: string | null;
  /** Messages keyed by session ID. */
  messages: Record<string, Message[]>;
  /** Parts keyed by message ID. */
  parts: Record<string, Part[]>;
  /** Session statuses keyed by session ID. */
  sessionStatus: Record<string, SessionStatus>;
  /** Active session's pending permission requests. */
  pendingPermissions: PermissionRequest[];
  /** Active session's pending question requests. */
  pendingQuestions: QuestionRequest[];

  /** Per-session file diffs keyed by session ID. Populated from Session.summary.diffs and session.diff SSE events. */
  sessionDiffs: Record<string, SnapshotFileDiff[]>;

  /** Set of child session IDs that have been loaded on demand. */
  loadedChildSessions: Set<string>;

  workspaceName: string | null;
  workspaceRoot: string | null;
  lspServers: LspServerInfo[];
  mcpServers: McpServerInfo[];
  skills: SkillInfo[];
  commands: CommandInfo[];
  plugins: string[];
  extensionVersion: string;

  setActiveSession: (id: string) => void;
  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  removeSession: (id: string) => void;
  updateSession: (session: Session) => void;
  addMessage: (sessionID: string, message: Message) => void;
  updateMessage: (message: Message) => void;
  removeMessagesFrom: (sessionID: string, fromMessageID: string) => void;
  removePart: (messageID: string, partID: string) => void;
  addPart: (messageID: string, part: Part) => void;
  updatePart: (part: Part) => void;
  updatePartDelta: (messageID: string, partID: string, field: string, delta: string) => void;
  setSessionStatus: (sessionID: string, status: SessionStatus) => void;
  addPendingPermission: (permission: PermissionRequest) => void;
  removePendingPermission: (id: string) => void;
  addPendingQuestion: (question: QuestionRequest) => void;
  removePendingQuestion: (id: string) => void;
  /**
   * Bulk-sets messages and their associated parts for a session, rebuilding the parts map.
   * Optionally restores the session's processing status (e.g., 'busy') so the webview
   * can correctly show/hide action buttons after reconstruction.
   */
  setSessionMessagesAndParts: (
    sessionID: string,
    messages: Message[],
    parts: Part[],
    /** Optional session status to restore on webview rebuild. */
    status?: SessionStatus,
  ) => void;
  setPendingRequests: (
    sessionID: string,
    permissions: PermissionRequest[],
    questions: QuestionRequest[],
  ) => void;

  /** Replaces the file diffs for a specific session. */
  setSessionDiffs: (sessionID: string, diffs: SnapshotFileDiff[]) => void;

  /**
   * Sends an IPC request to load a child session's messages if not already loaded.
   * Marks the session as loading to prevent duplicate requests.
   */
  fetchChildSession: (sessionID: string) => void;

  /**
   * Merges child session messages and parts into the store without affecting
   * the parent session or other child sessions.
   */
  mergeChildSessionData: (sessionID: string, messages: Message[], parts: Part[]) => void;

  /** Resets the loaded child sessions tracking set (called on session switch). */
  clearChildSessions: () => void;

  setWorkspaceName: (name: string | null) => void;
  setWorkspaceRoot: (root: string | null) => void;
  setLspServers: (lsp: LspServerInfo[]) => void;
  setMcpServers: (mcp: McpServerInfo[]) => void;
  setSkills: (skills: SkillInfo[]) => void;
  setCommands: (commands: CommandInfo[]) => void;
  setPlugins: (plugins: string[]) => void;
  setExtensionVersion: (version: string) => void;

  fileInfos: Record<
    string,
    { exists: boolean; size: number; content?: string; isWorkspace: boolean }
  >;
  setFileInfo: (
    path: string,
    info: { exists: boolean; size: number; content?: string; isWorkspace: boolean },
  ) => void;
}

/** Zustand store for all session-related state in the webview. */
export const useSessionStore = create<SessionStore>((set) => ({
  sessions: [],
  activeSessionID: null,
  messages: {},
  parts: {},
  sessionStatus: {},
  sessionDiffs: {},
  loadedChildSessions: new Set(),
  pendingPermissions: [],
  pendingQuestions: [],

  setActiveSession: (id) => set({ activeSessionID: id }),

  /** Replaces the session list, preserving active session if still present. */
  setSessions: (sessions) =>
    set((state) => {
      const activeExists = sessions.some((s) => s.id === state.activeSessionID);
      return {
        sessions,
        activeSessionID: activeExists
          ? state.activeSessionID
          : sessions.length > 0
            ? sessions[0].id
            : null,
      };
    }),

  /** Adds a session if not already present (deduplication). */
  addSession: (session) =>
    set((state) => {
      if (state.sessions.some((s) => s.id === session.id)) {
        return {};
      }
      return {
        sessions: [...state.sessions, session],
      };
    }),

  /** Removes a session and clears activeSessionID if it was the active one. */
  removeSession: (id) =>
    set((state) => {
      const nextDiffs = Object.fromEntries(
        Object.entries(state.sessionDiffs).filter(([key]) => key !== id),
      );
      return {
        sessions: state.sessions.filter((s) => s.id !== id),
        activeSessionID: state.activeSessionID === id ? null : state.activeSessionID,
        pendingPermissions: state.pendingPermissions.filter((p) => p.sessionID !== id),
        pendingQuestions: state.pendingQuestions.filter((q) => q.sessionID !== id),
        sessionDiffs: nextDiffs,
      };
    }),

  updateSession: (session) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === session.id ? session : s)),
    })),

  /** Adds or updates a message (upsert by ID) within a session. */
  addMessage: (sessionID, message) =>
    set((state) => {
      const currentMessages = state.messages[sessionID] || [];
      const exists = currentMessages.some((m) => m.id === message.id);
      const newMessages = exists
        ? currentMessages.map((m) => (m.id === message.id ? message : m))
        : [...currentMessages, message];
      return {
        messages: {
          ...state.messages,
          [sessionID]: newMessages,
        },
      };
    }),

  /** Updates a single message by ID in its session's message list. */
  updateMessage: (message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [message.sessionID]: (state.messages[message.sessionID] || []).map((m) =>
          m.id === message.id ? message : m,
        ),
      },
    })),

  /** Removes the target message and all subsequent messages from a session's store.
   *  Also removes associated parts. Uses array position (not string comparison) to
   *  determine ordering, avoiding lexicographic pitfalls with varying ID formats. */
  removeMessagesFrom: (sessionID, fromMessageID) =>
    set((state) => {
      const sessionMessages = state.messages[sessionID] || [];
      const idx = sessionMessages.findIndex((m) => m.id === fromMessageID);
      if (idx === -1) return {};
      const removedIds = new Set(sessionMessages.slice(idx).map((m) => m.id));
      const newMessages = sessionMessages.slice(0, idx);
      const newParts = { ...state.parts };
      for (const id of removedIds) {
        delete newParts[id];
      }
      return {
        messages: { ...state.messages, [sessionID]: newMessages },
        parts: newParts,
      };
    }),

  setSessionMessagesAndParts: (sessionID, messages, parts, status) =>
    set((state) => {
      // Group messages by their respective sessionID.
      // We start with a copy of the existing messages map.
      const groupedMessages: Record<string, Message[]> = { ...state.messages };
      // Clear out the active session's message list to replace it.
      groupedMessages[sessionID] = [];
      // Also clear out any child sessions that are present in the incoming messages,
      // so we do not end up appending duplicates.
      for (const m of messages) {
        groupedMessages[m.sessionID] = [];
      }
      // Populate the lists.
      for (const m of messages) {
        groupedMessages[m.sessionID].push(m);
      }

      // Initialize empty part arrays for each message, then populate.
      // When merging, preserve the local version of a part if it has more
      // accumulated text/reasoning content than the server snapshot. This
      // prevents losing streaming delta content when the user switches
      // sessions or reloads the webview mid-stream.
      const partsMap: Record<string, Part[]> = { ...state.parts };
      for (const m of messages) {
        partsMap[m.id] = [];
      }
      for (const p of parts) {
        if (!partsMap[p.messageID]) {
          partsMap[p.messageID] = [];
        }
        const localParts = state.parts[p.messageID] || [];
        const localPart = localParts.find((lp) => lp.id === p.id);
        if (localPart) {
          // Keep the local version if it has more accumulated streaming content.
          // Deltas are append-only, so longer text means more up-to-date data.
          // Both TextPart and ReasoningPart use a `.text` field for accumulated content.
          const getLen = (part: Part): number =>
            typeof (part as Record<string, unknown>).text === 'string'
              ? ((part as Record<string, unknown>).text as string).length
              : 0;
          if (getLen(localPart) > getLen(p)) {
            partsMap[p.messageID].push(localPart);
          } else {
            partsMap[p.messageID].push(p);
          }
        } else {
          partsMap[p.messageID].push(p);
        }
      }
      const newSessionStatus = status
        ? { ...state.sessionStatus, [sessionID]: status }
        : state.sessionStatus;
      return {
        messages: groupedMessages,
        parts: partsMap,
        sessionStatus: newSessionStatus,
      };
    }),

  /** Removes a single part by ID from a message's part list. */
  removePart: (messageID, partID) =>
    set((state) => {
      const currentParts = state.parts[messageID];
      if (!currentParts) return {};
      const newParts = currentParts.filter((p) => p.id !== partID);
      return {
        parts: {
          ...state.parts,
          [messageID]: newParts,
        },
      };
    }),

  /** Appends a part to a message's part list. */
  addPart: (messageID, part) =>
    set((state) => ({
      parts: {
        ...state.parts,
        [messageID]: [...(state.parts[messageID] || []), part],
      },
    })),

  /** Adds or updates a part (upsert by ID) within a message. */
  updatePart: (part) =>
    set((state) => {
      const messageID = part.messageID;
      const currentParts = state.parts[messageID] || [];
      const exists = currentParts.some((p) => p.id === part.id);
      const newParts = exists
        ? currentParts.map((p) => (p.id === part.id ? part : p))
        : [...currentParts, part];
      return {
        parts: {
          ...state.parts,
          [messageID]: newParts,
        },
      };
    }),

  /** Appends a delta string to an existing part field, creating a skeleton part if needed. */
  updatePartDelta: (messageID, partID, field, delta) =>
    set((state) => {
      const currentParts = state.parts[messageID] || [];
      const exists = currentParts.some((p) => p.id === partID);

      let newParts: Part[];
      if (exists) {
        // Append delta to existing part's field (e.g., streaming text)
        newParts = currentParts.map((p) => {
          if (p.id === partID) {
            const record = p as Record<string, unknown>;
            const existingValue = record[field] as string | undefined;
            return {
              ...p,
              [field]: (existingValue || '') + delta,
            };
          }
          return p;
        });
      } else {
        // If part delta arrives before the part itself, create a skeleton
        const newPart = {
          id: partID,
          messageID,
          type: 'text', // Fallback to 'text' type default
          [field]: delta,
        };
        newParts = [...currentParts, newPart as unknown as Part];
      }

      return {
        parts: {
          ...state.parts,
          [messageID]: newParts,
        },
      };
    }),

  /** Updates the status for a specific session (idle, busy, retry). */
  setSessionStatus: (sessionID, status) =>
    set((state) => ({
      sessionStatus: { ...state.sessionStatus, [sessionID]: status },
    })),

  /** Adds a pending permission request if it's not already in the list. */
  addPendingPermission: (permission) =>
    set((state) => {
      if (state.pendingPermissions.some((p) => p.id === permission.id)) {
        return {};
      }
      return { pendingPermissions: [...state.pendingPermissions, permission] };
    }),

  /** Removes a pending permission request by its request ID. */
  removePendingPermission: (id) =>
    set((state) => ({
      pendingPermissions: state.pendingPermissions.filter((p) => p.id !== id),
    })),

  /** Adds a pending question request if it's not already in the list. */
  addPendingQuestion: (question) =>
    set((state) => {
      if (state.pendingQuestions.some((q) => q.id === question.id)) {
        return {};
      }
      return { pendingQuestions: [...state.pendingQuestions, question] };
    }),

  /** Removes a pending question request by its request ID. */
  removePendingQuestion: (id) =>
    set((state) => ({
      pendingQuestions: state.pendingQuestions.filter((q) => q.id !== id),
    })),

  /** Synchronizes the pending permissions and questions for a session from the extension host buffer. */
  setPendingRequests: (sessionID, permissions, questions) =>
    set((state) => ({
      pendingPermissions: [
        ...state.pendingPermissions.filter((p) => p.sessionID !== sessionID),
        ...permissions,
      ],
      pendingQuestions: [
        ...state.pendingQuestions.filter((q) => q.sessionID !== sessionID),
        ...questions,
      ],
    })),

  workspaceName: null,
  workspaceRoot: null,
  lspServers: [],
  mcpServers: [],
  skills: [],
  commands: [],
  plugins: [],
  extensionVersion: 'unknown',

  setWorkspaceName: (workspaceName) => set({ workspaceName }),
  setWorkspaceRoot: (workspaceRoot) => set({ workspaceRoot }),
  setSessionDiffs: (sessionID, diffs) =>
    set((state) => ({
      sessionDiffs: { ...state.sessionDiffs, [sessionID]: diffs },
    })),

  fetchChildSession: (sessionID) => {
    const state = useSessionStore.getState();
    if (state.loadedChildSessions.has(sessionID)) return;
    set(() => {
      const newSet = new Set(state.loadedChildSessions);
      newSet.add(sessionID);
      return { loadedChildSessions: newSet };
    });
    window.vscode.postMessage({ type: 'session:load-child-messages', sessionID });
  },

  mergeChildSessionData: (sessionID, messages, parts) =>
    set((state) => {
      const groupedMessages = { ...state.messages, [sessionID]: messages };
      const partsMap = { ...state.parts };
      const validMessageIDs = new Set(messages.map((m) => m.id));
      for (const m of messages) {
        partsMap[m.id] = [];
      }
      for (const p of parts) {
        if (!validMessageIDs.has(p.messageID)) continue;
        partsMap[p.messageID].push(p);
      }
      return { messages: groupedMessages, parts: partsMap };
    }),

  clearChildSessions: () => set({ loadedChildSessions: new Set() }),
  setLspServers: (lspServers) => set({ lspServers }),
  setMcpServers: (mcpServers) => set({ mcpServers }),
  setSkills: (skills) => set({ skills }),
  setCommands: (commands) => set({ commands }),
  setPlugins: (plugins) => set({ plugins }),
  setExtensionVersion: (extensionVersion) => set({ extensionVersion }),

  fileInfos: {},
  setFileInfo: (path, info) =>
    set((state) => ({
      fileInfos: {
        ...state.fileInfos,
        [path]: info,
      },
    })),
}));
