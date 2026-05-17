/**
 * @file Webview test setup — mocks VS Code API, matchMedia, and adds jest-dom matchers.
 */

import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

declare global {
  interface Window {
    acquireVsCodeApi: <T = unknown>() => {
      postMessage: (message: T) => void;
      getState: () => T | undefined;
      setState: (state: T) => void;
    };
    vscode: {
      postMessage: (message: unknown) => void;
      getState: () => unknown;
      setState: (state: unknown) => void;
    };
  }
}

window.acquireVsCodeApi = () => ({
  postMessage: vi.fn(),
  getState: () => undefined,
  setState: vi.fn(),
});

Object.defineProperty(window, 'vscode', {
  value: {
    postMessage: vi.fn(),
    getState: () => undefined,
    setState: vi.fn(),
  },
  writable: true,
  configurable: true,
});

Object.defineProperty(window, 'matchMedia', {
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
  writable: true,
});
