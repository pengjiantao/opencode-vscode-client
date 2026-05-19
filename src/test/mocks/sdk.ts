/**
 * @file Mock factory functions for creating test SDK objects
 * (messages, parts, sessions, statuses) with sensible defaults.
 */

import type {
  AssistantMessage,
  ReasoningPart,
  Session,
  SessionStatus,
  TextPart,
  ToolPart,
  UserMessage,
} from '@opencode-ai/sdk/v2/client';

export type { Message, Part } from '@opencode-ai/sdk/v2/client';
export type {
  AssistantMessage,
  ReasoningPart,
  Session,
  SessionStatus,
  TextPart,
  ToolPart,
  UserMessage,
};

/** Creates a user message with a unique ID and default properties. */
export function createMockUserMessage(): UserMessage {
  return {
    id: 'msg-1',
    sessionID: 'session-1',
    role: 'user',
    time: { created: Date.now() },
    agent: '',
    model: { providerID: '', modelID: '' },
  };
}

/** Creates an assistant message with a parent reference to msg-1. */
export function createMockAssistantMessage(): AssistantMessage {
  return {
    id: 'msg-2',
    sessionID: 'session-1',
    role: 'assistant',
    time: { created: Date.now() },
    parentID: 'msg-1',
    modelID: '',
    providerID: '',
    agent: '',
    mode: '',
    path: { cwd: '', root: '' },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  };
}

/** Creates a text part with optional custom text content. */
export function createMockTextPart(text = 'Hello!'): TextPart {
  return { type: 'text', id: 'part-1', sessionID: 'session-1', messageID: 'msg-1', text };
}

/** Creates a tool part (e.g., bash) in 'running' status. */
export function createMockToolPart(tool = 'bash'): ToolPart {
  return {
    type: 'tool',
    id: 'tool-1',
    sessionID: 'session-1',
    messageID: 'msg-1',
    callID: 'call-1',
    tool,
    state: { status: 'running', input: {}, time: { start: Date.now() } },
  };
}

/** Creates a reasoning part with optional custom thinking text. */
export function createMockReasoningPart(text = 'Let me think...'): ReasoningPart {
  return {
    type: 'reasoning',
    id: 'reasoning-1',
    sessionID: 'session-1',
    messageID: 'msg-1',
    text,
    time: { start: Date.now() },
  };
}

/** Creates a session status (idle/busy/retry) with optional overrides. */
export function createMockSessionStatus(
  overrides: {
    type?: 'idle' | 'busy' | 'retry';
    attempt?: number;
    message?: string;
    next?: number;
  } = {},
): SessionStatus {
  if (!overrides.type || overrides.type === 'idle') return { type: 'idle' };
  if (overrides.type === 'busy') return { type: 'busy' };
  return {
    type: 'retry',
    attempt: overrides.attempt ?? 1,
    message: overrides.message ?? '',
    next: overrides.next ?? 1,
  };
}

let sessionCounter = 0;

/** Creates a session with auto-incrementing unique IDs and optional field overrides. */
export function createMockSession(overrides: Partial<Session> = {}): Session {
  return {
    id: `session-${++sessionCounter}`,
    slug: '',
    projectID: '',
    directory: '',
    title: 'Untitled',
    version: '',
    time: { created: Date.now(), updated: Date.now() },
    ...overrides,
  };
}
