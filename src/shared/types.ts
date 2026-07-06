/**
 * @file Shared type definitions used by both extension host and webview.
 * Defines the IPC message protocol between the two sides.
 */

import type {
  Event,
  Message,
  Part,
  PermissionRequest,
  QuestionRequest,
  Session,
  SessionStatus,
  SnapshotFileDiff,
} from '@opencode-ai/sdk/v2/client';

export type { Event, Part, SnapshotFileDiff };

/**
 * A single entry in the prompt input history (Up/Down recall).
 * Mirrors the shape persisted by the opencode TUI in `prompt-history.jsonl` so the
 * two clients behave consistently for users who switch between them.
 */
export interface PromptHistoryEntry {
  /** The expanded prompt text the user submitted (paste placeholders resolved). */
  input: string;
  /** The associated rich parts (file/image/code-selection/etc.) at submit time. */
  parts: Part[];
  /** Editor mode at submit time. Reserved for future shell-mode parity. */
  mode?: 'normal';
}

/**
 * Status information for an active Language Server Protocol (LSP) server.
 */
export interface LspServerInfo {
  /** Name of the language server. */
  name: string;
  /** Running status of the language server. */
  status: string;
  /** Active workspace folder associated with the server. */
  workspaceFolder?: string;
}

/**
 * Status information for a Model Context Protocol (MCP) server.
 */
export interface McpServerInfo {
  /** Name of the MCP server. */
  name: string;
  /** Current connection or running status. */
  status: string;
  /** Optional error message if the server failed to start or connect. */
  error?: string;
}

/**
 * Details of a discovered skill.
 */
export interface SkillInfo {
  /** Unique name of the skill. */
  name: string;
  /** Short description explaining what the skill does. */
  description?: string;
  /** Path or location where the skill definition resides. */
  location: string;
  /** Optional source code or configuration content of the skill. */
  content?: string;
}

/**
 * Information on an executable command.
 */
export interface CommandInfo {
  /** Executable command identifier. */
  name: string;
  /** Brief description of the command function. */
  description?: string;
  /** Origin source of the command. */
  source?: 'command' | 'mcp' | 'skill';
  /** Associated target agent name (optional). */
  agent?: string;
  /** Target model (optional). */
  model?: string;
  /** Usage hints or example parameter patterns (optional). */
  hints?: string[];
}

/**
 * Info about a language model provider and its capability limits.
 */
export interface ModelInfo {
  /** Unique model identifier. */
  id: string;
  /** Human-readable model name. */
  name: string;
  /** Unique identifier for the provider (optional). */
  providerId?: string;
  /** Display name of the provider (optional). */
  providerName?: string;
  /** If false, the model connection is disabled or disconnected. */
  isConnected?: boolean;
  /** Maximum token limit supported by the model (optional). */
  contextLimit?: number;
  /** Available variants/reasoning profiles for the model (optional). */
  variants?: string[];
}

/**
 * Info about an AI agent.
 */
export interface AgentInfo {
  /** Unique agent identifier. */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Run mode (e.g. 'subagent', 'primary'). */
  mode?: string;
  /** If true, the agent is hidden from standard selectors. */
  hidden?: boolean;
}

/**
 * Result structure of a workspace file/directory search.
 */
export interface WorkspaceSearchResult {
  /** File or directory name. */
  name: string;
  /** Relative path from workspace root. */
  relativePath: string;
  /** Whether the entry is a file or a directory. */
  type: 'file' | 'dir';
  /** Absolute file system path. */
  fsPath: string;
}

/**
 * Represents metadata of a selected file from a dialog.
 */
export interface SelectedFileInfo {
  /** Base filename. */
  name: string;
  /** Absolute file system path. */
  fsPath: string;
  /** File size in bytes. */
  size: number;
  /** MIME type of the file. */
  mime: string;
  /** Optional base64 data URL representation. */
  dataUrl?: string;
}

/**
 * Metadata for a pasted clipboard file whose absolute path must be resolved by the extension host.
 */
export interface ClipboardFilePathRequest {
  /** Base filename reported by the webview clipboard API. */
  name: string;
  /** File size in bytes when available. */
  size?: number;
  /** MIME type inferred or reported by the webview. */
  mime: string;
}

/**
 * Protocol messages sent from the extension host to the webview.
 */
export type ExtToWebview =
  | { type: 'session:created'; session: Session }
  | {
      type: 'pending-requests';
      sessionID: string;
      permissions: PermissionRequest[];
      questions: QuestionRequest[];
    }
  | {
      type: 'session:switched';
      sessionID: string;
      model?: string;
      agent?: string;
      modelVariants?: Record<string, string>;
    }
  | { type: 'session:archived'; sessionID: string }
  | { type: 'session:updated'; session: Session }
  | { type: 'session:deleted'; sessionID: string }
  | {
      /**
       * Bulk snapshot of every session's processing status, sourced from the backend
       * during init. The webview uses this to immediately render busy/retry indicators
       * across all open tabs without waiting for per-session SSE events to arrive.
       */
      type: 'session:statuses-bulk';
      statuses: Record<string, SessionStatus>;
    }
  | {
      type: 'session:diffs';
      diffs: Record<
        string,
        Array<{
          file?: string;
          additions: number;
          deletions: number;
          status?: string;
          patch?: string;
        }>
      >;
    }
  | { type: 'event:received'; event: Event }
  | { type: 'fork:confirm'; sessionID: string }
  | { type: 'error'; message: string }
  | {
      type: 'init';
      sessions: Session[];
    }
  | { type: 'models:list'; models: ModelInfo[] }
  | { type: 'agents:list'; agents: AgentInfo[] }
  | {
      type: 'messages:list';
      sessionID: string;
      messages: Message[];
      parts: Part[];
      status?: SessionStatus;
    }
  | {
      type: 'messages:child-loaded';
      sessionID: string;
      messages: Message[];
      parts: Part[];
    }
  | {
      type: 'file:query-response';
      path: string;
      exists: boolean;
      filename: string;
      size: number;
      content?: string;
      isWorkspace: boolean;
    }
  | {
      type: 'workspace:search-files-response';
      query: string;
      results: WorkspaceSearchResult[];
    }
  | {
      type: 'metadata:sync';
      workspaceName: string | null;
      workspaceRoot: string | null;
      lspServers: LspServerInfo[];
      mcpServers: McpServerInfo[];
      skills: SkillInfo[];
      commands: CommandInfo[];
      plugins: string[];
      extensionVersion: string;
      /** VS Code marketplace publisher id (e.g. 'fiyqkrc'). 'unknown' when not resolvable. */
      publisher: string;
      /** Opencode server version reported by GET /global/health. 'unknown' on failure. */
      opencodeVersion: string;
    }
  | {
      type: 'editor:selection';
      text: string;
      filename: string;
      path: string;
      startLine: number;
      endLine: number;
      action: 'insert' | 'explain';
    }
  | {
      type: 'terminal:selection';
      text: string;
      linesCount: number;
      action: 'insert' | 'explain-fix';
    }
  | {
      type: 'file:selected';
      files: SelectedFileInfo[];
    }
  | {
      /** Response to a clipboard file path resolution request from the webview. */
      type: 'clipboard:file-paths-resolved';
      /** Correlates the async response to the original paste event request. */
      requestID: string;
      /** Files whose absolute filesystem paths were recovered by the extension host. */
      files: SelectedFileInfo[];
      /** Files that could not be matched to a real absolute path. */
      unresolved: ClipboardFilePathRequest[];
    }
  | {
      type: 'editor:paste-plain-text';
      text: string;
    }
  | {
      type: 'review:data';
      reviewID: string;
      diffs: SnapshotFileDiff[];
      title: string;
      scope?: 'turn' | 'session';
    }
  | { type: 'review:error'; reviewID: string; message: string }
  | { type: 'review:closed'; reviewID: string }
  | {
      /** Bulk snapshot of stored prompt history entries, sent in response to `prompt-history:list`. */
      type: 'prompt-history:list';
      entries: PromptHistoryEntry[];
    }
  | {
      /**
       * Notifies the webview that the extension just appended a new history entry
       * (e.g. after a submit). The webview's mirror needs this to make the entry
       * immediately recallable via Up/Down without requiring a reload.
       */
      type: 'prompt-history:appended';
      entry: PromptHistoryEntry;
    };

/**
 * Protocol messages sent from the webview to the extension host.
 */
export type WebviewToExt =
  | { type: 'session:create' }
  | { type: 'session:switch'; sessionID: string }
  | { type: 'session:archive'; sessionID: string }
  | { type: 'session:close'; sessionID: string }
  | { type: 'session:close-all' }
  | { type: 'session:title'; sessionID: string; title: string }
  | { type: 'prompt:send'; text?: string; parts?: Part[] }
  | { type: 'prompt:abort'; sessionID: string }
  | { type: 'model:switch'; sessionID?: string; model: string }
  | { type: 'agent:switch'; sessionID?: string; agent: string }
  | { type: 'variant:switch'; sessionID?: string; model: string; variant: string }
  | {
      type: 'permission:reply';
      permissionID: string;
      reply?: 'once' | 'always' | 'reject';
      allow?: boolean;
    }
  | {
      type: 'question:reply';
      requestID: string;
      answers: string[][];
    }
  | {
      type: 'question:reject';
      requestID: string;
    }
  | { type: 'sessions:select-history' }
  | { type: 'file:open'; path: string; startLine?: number; endLine?: number }
  | { type: 'file:query'; path: string }
  | { type: 'workspace:search-files'; query: string }
  | { type: 'file:select' }
  | {
      /** Requests extension-host recovery of absolute paths for pasted clipboard files. */
      type: 'clipboard:resolve-file-paths';
      /** Unique ID generated by the webview for matching the async response. */
      requestID: string;
      /** Clipboard file metadata available from the browser DataTransfer API. */
      files: ClipboardFilePathRequest[];
    }
  | { type: 'clipboard:paste-plain-text' }
  | {
      type: 'review:request';
      sessionID: string;
      messageID?: string;
      reviewID: string;
      diffs?: SnapshotFileDiff[];
      scope?: 'turn' | 'session';
    }
  | { type: 'review:close'; reviewID: string }
  | { type: 'init' }
  | { type: 'sync-pending-requests' }
  | { type: 'pong' }
  | { type: 'session:revert'; sessionID: string; messageID: string }
  | { type: 'session:unrevert'; sessionID: string }
  | { type: 'session:fork'; sessionID: string; messageID?: string }
  | { type: 'session:load-child-messages'; sessionID: string }
  | { type: 'prompt-history:list' }
  | { type: 'prompt-history:append'; entry: PromptHistoryEntry };
