import type { Event, Message, Part } from '@opencode-ai/sdk';

export type { Event };

// Extension → Webview messages
export type ExtToWebview =
  | { type: 'session:created'; session: unknown }
  | { type: 'session:switched'; sessionID: string }
  | { type: 'session:archived'; sessionID: string }
  | { type: 'session:updated'; session: unknown }
  | { type: 'session:deleted'; sessionID: string }
  | { type: 'event:received'; event: Event }
  | { type: 'error'; message: string }
  | { type: 'init'; sessions: unknown[] }
  | { type: 'models:list'; models: Array<{ id: string; name: string }> }
  | { type: 'agents:list'; agents: Array<{ id: string; name: string }> }
  | { type: 'messages:list'; sessionID: string; messages: Message[]; parts: Part[] };

// Webview → Extension messages
export type WebviewToExt =
  | { type: 'session:create' }
  | { type: 'session:switch'; sessionID: string }
  | { type: 'session:archive'; sessionID: string }
  | { type: 'session:title'; sessionID: string; title: string }
  | { type: 'prompt:send'; text: string }
  | { type: 'prompt:abort'; sessionID: string }
  | { type: 'model:switch'; model: string }
  | { type: 'agent:switch'; agent: string }
  | { type: 'permission:reply'; permissionID: string; allow: boolean }
  | { type: 'sessions:select-history' }
  | { type: 'init' }
  | { type: 'pong' };
