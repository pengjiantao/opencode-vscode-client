import type { Event } from '@opencode-ai/sdk';
import { vi } from 'vitest';

export type MockEventSource = {
  emit: (event: Event) => void;
  handler: (event: Event) => void;
};

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
