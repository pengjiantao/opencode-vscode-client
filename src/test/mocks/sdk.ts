import type {
  AssistantMessage,
  ReasoningPart,
  Session,
  SessionStatus,
  TextPart,
  ToolPart,
  UserMessage,
} from '@opencode-ai/sdk';

export type { Message, Part } from '@opencode-ai/sdk';
export type {
  AssistantMessage,
  ReasoningPart,
  Session,
  SessionStatus,
  TextPart,
  ToolPart,
  UserMessage,
};

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

export function createMockAssistantMessage(): AssistantMessage {
  return {
    id: 'msg-2',
    sessionID: 'session-1',
    role: 'assistant',
    time: { created: Date.now() },
    parentID: 'msg-1',
    modelID: '',
    providerID: '',
    mode: '',
    path: { cwd: '', root: '' },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  };
}

export function createMockTextPart(text = 'Hello!'): TextPart {
  return { type: 'text', id: 'part-1', sessionID: 'session-1', messageID: 'msg-1', text };
}

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

export function createMockSession(overrides: Partial<Session> = {}): Session {
  return {
    id: `session-${++sessionCounter}`,
    projectID: '',
    directory: '',
    title: 'Untitled',
    version: '',
    time: { created: Date.now(), updated: Date.now() },
    ...overrides,
  };
}
