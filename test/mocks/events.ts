/**
 * @file Mock SSE event source for testing event subscription and streaming.
 */

import type { Event } from '@opencode-ai/sdk';
import { vi } from 'vitest';

/** Event source mock that allows emitting events programmatically. */
export type MockEventSource = {
  emit: (event: Event) => void;
  handler: (event: Event) => void;
};

/** Creates a mock event source with emit, subscribe, and unsubscribe capabilities. */
export const createMockEventSource = (): MockEventSource & {
  subscribe: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
} => {
  let handler: ((event: Event) => void) | null = null;

  return {
    emit(event: Event) {
      if (handler) {
        handler(event);
      }
    },
    handler(event: Event) {
      if (handler) {
        handler(event);
      }
    },
    subscribe: vi.fn((h: (event: Event) => void) => {
      handler = h;
      return () => {
        handler = null;
      };
    }),
    unsubscribe: vi.fn(() => {
      handler = null;
    }),
  };
};

/** Creates a ReadableStream that emits given events as SSE-formatted data. */
export const createMockSSEStream = (events: Event[]): ReadableStream => {
  let controller: ReadableStreamDefaultController;

  return new ReadableStream({
    start(c) {
      controller = c;
    },
    pull() {
      for (const event of events) {
        const data = JSON.stringify(event);
        controller.enqueue(`data: ${data}\n\n`);
      }
      controller.close();
    },
    cancel() {},
  });
};
