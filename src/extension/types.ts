import type { Event, Session } from '@opencode-ai/sdk';

export type ExtToWebview =
  | { type: 'session:created'; session: Session }
  | { type: 'session:switched'; sessionID: string }
  | { type: 'session:archived'; sessionID: string }
  | { type: 'session:updated'; session: Session }
  | { type: 'session:deleted'; sessionID: string }
  | { type: 'event:received'; event: Event }
  | { type: 'error'; message: string }
  | { type: 'init'; sessions: Session[] };

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
  | { type: 'init' }
  | { type: 'pong' };
