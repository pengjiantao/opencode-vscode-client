/**
 * @file Type definitions for IPC messages between extension host and webview.
 * These types are specific to the extension host; shared types live in src/shared/types.ts.
 */

import type { Event, Message, Part, Session } from '@opencode-ai/sdk/v2/client';
import type { LspServerInfo, McpServerInfo, SkillInfo } from '../shared/types';

export type { LspServerInfo, McpServerInfo, SkillInfo };

/** Messages sent from the extension host to the webview. */
export type ExtToWebview =
  | { type: 'session:created'; session: Session }
  | { type: 'session:switched'; sessionID: string }
  | { type: 'session:archived'; sessionID: string }
  | { type: 'session:updated'; session: Session }
  | { type: 'session:deleted'; sessionID: string }
  | { type: 'event:received'; event: Event }
  | { type: 'error'; message: string }
  | { type: 'init'; sessions: Session[]; activeModel?: string; activeAgent?: string }
  | { type: 'settings:open' }
  | {
      type: 'models:list';
      models: Array<{
        id: string;
        name: string;
        providerId?: string;
        providerName?: string;
        isConnected?: boolean;
        contextLimit?: number;
      }>;
    }
  | {
      type: 'agents:list';
      agents: Array<{ id: string; name: string; mode?: string; hidden?: boolean }>;
    }
  | { type: 'messages:list'; sessionID: string; messages: Message[]; parts: Part[] }
  | {
      type: 'metadata:sync';
      workspaceName: string | null;
      lspServers: LspServerInfo[];
      mcpServers: McpServerInfo[];
      skills: SkillInfo[];
      plugins: string[];
      extensionVersion: string;
    };

/** Messages sent from the webview to the extension host. */
export type WebviewToExt =
  | { type: 'session:create' }
  | { type: 'session:switch'; sessionID: string }
  | { type: 'session:archive'; sessionID: string }
  | { type: 'session:close'; sessionID: string }
  | { type: 'session:close-all' }
  | { type: 'session:title'; sessionID: string; title: string }
  | { type: 'prompt:send'; text: string }
  | { type: 'prompt:abort'; sessionID: string }
  | { type: 'model:switch'; model: string }
  | { type: 'agent:switch'; agent: string }
  | { type: 'permission:reply'; permissionID: string; allow: boolean }
  | { type: 'init' }
  | { type: 'pong' };
