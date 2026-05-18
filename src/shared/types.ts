/**
 * @file Shared type definitions used by both extension host and webview.
 * Defines the IPC message protocol between the two sides.
 */

import type { Event, Message, Part } from '@opencode-ai/sdk';

export type { Event };

/** Messages sent from the extension host to the webview. */
export type ExtToWebview =
  | { type: 'session:created'; session: unknown }
  | { type: 'session:switched'; sessionID: string }
  | { type: 'session:archived'; sessionID: string }
  | { type: 'session:updated'; session: unknown }
  | { type: 'session:deleted'; sessionID: string }
  | { type: 'event:received'; event: Event }
  | { type: 'error'; message: string }
  | { type: 'init'; sessions: unknown[]; activeModel?: string; activeAgent?: string }
  | { type: 'settings:open' }
  | {
      type: 'models:list';
      models: Array<{
        id: string;
        name: string;
        providerId?: string;
        providerName?: string;
        isConnected?: boolean;
      }>;
    }
  | {
      type: 'agents:list';
      agents: Array<{ id: string; name: string; mode?: string; hidden?: boolean }>;
    }
  | { type: 'messages:list'; sessionID: string; messages: Message[]; parts: Part[] };

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
  | { type: 'sessions:select-history' }
  | { type: 'init' }
  | { type: 'pong' };
