/**
 * @file Unit tests for syncMetadata — verifies that the opencode server
 * version is fetched from the SDK and included in the metadata payload, with
 * graceful degradation to 'unknown' on failure.
 */

// Mock the `vscode` module before importing the SUT because metadata.ts uses
// `extensions` and `workspace` at module-evaluation time.
vi.mock('vscode', () => ({
  extensions: {
    getExtension: vi.fn(),
  },
  workspace: {
    workspaceFolders: undefined,
  },
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtensionKind } from 'vscode';
import { extensions, workspace } from 'vscode';
import { syncMetadata } from './metadata';
import type { SDKClient } from './sdk-client';
import type { ExtToWebview } from './types';

interface VscodeExtension<T> {
  readonly id: string;
  readonly extensionUri: import('vscode').Uri;
  readonly extensionPath: string;
  readonly isActive: boolean;
  readonly packageJSON: T;
  readonly extensionKind: ExtensionKind;
  readonly exports: unknown;
  readonly activate: () => Promise<unknown>;
}

function makeExtension(
  packageJSON: Record<string, unknown>,
): VscodeExtension<Record<string, unknown>> {
  return {
    id: 'fiyqkrc.opencode-vscode-client',
    extensionUri: {} as import('vscode').Uri,
    extensionPath: '/tmp/extension',
    isActive: true,
    packageJSON,
    extensionKind: 1 satisfies ExtensionKind,
    exports: {},
    activate: () => Promise.resolve(),
  };
}

function makeMockSdk(overrides: Partial<SDKClient> = {}): SDKClient {
  return {
    lsp: { status: vi.fn().mockResolvedValue([]) },
    mcp: { status: vi.fn().mockResolvedValue({}) },
    config: { get: vi.fn().mockResolvedValue({ plugin: [] }) },
    getSkills: vi.fn().mockResolvedValue([]),
    getCommands: vi.fn().mockResolvedValue([]),
    getServerVersion: vi.fn().mockResolvedValue({ version: '1.16.2', healthy: true }),
    ...overrides,
  } as unknown as SDKClient;
}

describe('syncMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(workspace, 'workspaceFolders', {
      value: undefined,
      configurable: true,
    });
  });

  it('regression: includes publisher from package.json and opencodeVersion from SDK in metadata:sync', async () => {
    vi.mocked(extensions.getExtension).mockReturnValue(
      makeExtension({ version: '0.1.32', publisher: 'fiyqkrc' }),
    );

    const sendIpc = vi.fn<(msg: ExtToWebview) => void>();
    await syncMetadata(makeMockSdk(), sendIpc);

    expect(sendIpc).toHaveBeenCalledTimes(1);
    const payload = sendIpc.mock.calls[0][0];
    expect(payload.type).toBe('metadata:sync');
    if (payload.type !== 'metadata:sync') throw new Error('unreachable');

    expect(payload.extensionVersion).toBe('0.1.32');
    expect(payload.publisher).toBe('fiyqkrc');
    expect(payload.opencodeVersion).toBe('1.16.2');
  });

  it('regression: degrades opencodeVersion to "unknown" when the SDK health call fails', async () => {
    vi.mocked(extensions.getExtension).mockReturnValue(
      makeExtension({ version: '0.1.32', publisher: 'fiyqkrc' }),
    );

    const failingSdk = makeMockSdk({
      getServerVersion: vi.fn().mockRejectedValue(new Error('network down')),
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const sendIpc = vi.fn<(msg: ExtToWebview) => void>();
    try {
      await syncMetadata(failingSdk, sendIpc);

      expect(sendIpc).toHaveBeenCalledTimes(1);
      const payload = sendIpc.mock.calls[0][0];
      if (payload.type !== 'metadata:sync') throw new Error('unreachable');

      expect(payload.extensionVersion).toBe('0.1.32');
      expect(payload.publisher).toBe('fiyqkrc');
      expect(payload.opencodeVersion).toBe('unknown');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to fetch opencode server version:',
        expect.any(Error),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('falls back to "unknown" for publisher and version when the extension is not registered', async () => {
    vi.mocked(extensions.getExtension).mockReturnValue(undefined);

    const sendIpc = vi.fn<(msg: ExtToWebview) => void>();
    await syncMetadata(makeMockSdk(), sendIpc);

    const payload = sendIpc.mock.calls[0][0];
    if (payload.type !== 'metadata:sync') throw new Error('unreachable');

    expect(payload.extensionVersion).toBe('unknown');
    expect(payload.publisher).toBe('unknown');
  });
});
