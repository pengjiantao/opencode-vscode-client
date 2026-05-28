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
} from '@opencode-ai/sdk/v2/client';

export type { Event };

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
      lspServers: LspServerInfo[];
      mcpServers: McpServerInfo[];
      skills: SkillInfo[];
      commands: CommandInfo[];
      plugins: string[];
      extensionVersion: string;
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
      type: 'editor:paste-plain-text';
      text: string;
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
  | { type: 'clipboard:paste-plain-text' }
  | { type: 'diff:open'; sessionID: string; messageID?: string }
  | { type: 'init' }
  | { type: 'sync-pending-requests' }
  | { type: 'pong' }
  | { type: 'session:revert'; sessionID: string; messageID: string }
  | { type: 'session:unrevert'; sessionID: string }
  | { type: 'session:fork'; sessionID: string; messageID?: string };
