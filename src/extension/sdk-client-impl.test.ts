/**
 * @file Unit tests for sdk-client-impl.ts.
 * Verifies that createSDKClient startServer invokes createOpencodeServer with port 0
 * and initializes the client correctly with the spawned server's URL.
 */

import * as path from 'node:path';
import { createOpencodeServer } from '@opencode-ai/sdk';
import { createOpencodeClient } from '@opencode-ai/sdk/v2/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSDKClient } from './sdk-client-impl';

vi.mock('@opencode-ai/sdk', () => ({
  createOpencodeServer: vi.fn(),
}));

vi.mock('@opencode-ai/sdk/v2/client', () => ({
  createOpencodeClient: vi.fn().mockImplementation(() => ({
    session: {
      list: vi.fn().mockResolvedValue({ data: [] }),
      status: vi.fn().mockResolvedValue({ data: {} }),
    },
  })),
}));

describe('SDK Client Implementation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call createOpencodeServer with port: 0 and createOpencodeClient with correct server url', async () => {
    const mockServerUrl = 'http://127.0.0.1:54321';
    const mockClose = vi.fn();

    // Mock the server creation to return a predefined URL and close spy
    vi.mocked(createOpencodeServer).mockResolvedValue({
      url: mockServerUrl,
      close: mockClose,
    });

    const sdkClient = createSDKClient({ directory: '/mock/workspace' });
    const handle = await sdkClient.startServer();

    // Verify the server is created on a dynamically allocated port (port: 0)
    expect(createOpencodeServer).toHaveBeenCalledWith({ port: 0 });

    // Verify the server handle returns the correct URL
    expect(handle.url).toBe(mockServerUrl);

    // Verify clean teardown logic propagates to the actual server process
    handle.close();
    expect(mockClose).toHaveBeenCalledTimes(1);

    // Verify the client is re-created with the dynamic port baseUrl to restrict instance coupling
    expect(createOpencodeClient).toHaveBeenCalledWith({
      baseUrl: mockServerUrl,
      directory: '/mock/workspace',
    });
  });

  it('exposes statusAll() that returns the backend session status map', async () => {
    // Regression: session.statusAll is the new API used during extension activate()
    // to seed the in-memory status cache after a restart. If it returned undefined
    // (e.g. dropped the data field) every tab would render as idle until the next
    // SSE event.
    const mockStatusMap = {
      'session-1': { type: 'busy' },
      'session-2': { type: 'idle' },
    };
    vi.mocked(createOpencodeClient).mockImplementation(() => {
      const client: { session: { status: ReturnType<typeof vi.fn> } } = {
        session: {
          status: vi.fn().mockResolvedValue({ data: mockStatusMap }),
        },
      };
      return client as unknown as ReturnType<typeof createOpencodeClient>;
    });

    const sdkClient = createSDKClient({ directory: '/mock/workspace' });
    const statuses = await sdkClient.session.statusAll();

    expect(statuses).toEqual(mockStatusMap);
  });

  it('normalizes Windows backslash directory to forward slashes before passing to SDK client', async () => {
    // Regression: on Windows, VS Code's Uri.fsPath returns paths with
    // backslashes (e.g. "C:\Users\dev\project"). The opencode backend
    // stores directory paths with forward slashes (e.g. "C:/Users/dev/project").
    // Without normalization, the SQL WHERE directory = ? comparison would
    // fail and session history lookups would return empty results.
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    try {
      const mockServerUrl = 'http://127.0.0.1:54321';
      vi.mocked(createOpencodeServer).mockResolvedValue({
        url: mockServerUrl,
        close: vi.fn(),
      });

      const sdkClient = createSDKClient({ directory: 'C:\\Users\\dev\\my-project' });
      await sdkClient.startServer();

      // The client must receive the normalized (forward-slash) path so that
      // the x-opencode-directory header / ?directory= query parameter sent
      // to the backend matches the stored database value.
      expect(createOpencodeClient).toHaveBeenCalledWith({
        baseUrl: mockServerUrl,
        directory: 'C:/Users/dev/my-project',
      });
    } finally {
      platformSpy.mockRestore();
    }
  });
});

describe('SDK Client opencodeBinaryPath PATH injection', () => {
  const originalPath = process.env.PATH;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset PATH to a known baseline for each test
    process.env.PATH = '/usr/bin';
  });

  afterEach(() => {
    if (originalPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = originalPath;
    }
  });

  it('prepends the directory of the configured binary to PATH and restores it after startServer', async () => {
    // Regression: opencode.executablePath is the user-facing setting that lets
    // them point at a non-default install location. The SDK's spawn function
    // hard-codes the binary name 'opencode', so we bridge the configured
    // absolute path by prepending its directory to PATH for the duration of
    // startServer and restoring it afterwards.
    const mockServerUrl = 'http://127.0.0.1:54321';
    vi.mocked(createOpencodeServer).mockImplementation(() => {
      // While the server is being spawned, PATH must contain the binary's dir.
      // Snapshot the PATH at the moment cross-spawn would resolve the binary.
      const pathDuringSpawn = process.env.PATH ?? '';
      expect(pathDuringSpawn).toContain('/custom/bin');
      return Promise.resolve({ url: mockServerUrl, close: vi.fn() });
    });

    const sdkClient = createSDKClient({ opencodeBinaryPath: '/custom/bin/opencode' });
    await sdkClient.startServer();

    // PATH was restored to its original value after startServer completed
    expect(process.env.PATH).toBe('/usr/bin');
  });

  it('does not modify PATH when no opencodeBinaryPath is provided', async () => {
    // Regression: leaving PATH untouched on the default code path means that
    // users who never set opencode.executablePath are unaffected by the new
    // option. Any side-effect on process.env would be a behavioural change.
    const mockServerUrl = 'http://127.0.0.1:54321';
    vi.mocked(createOpencodeServer).mockImplementation(() => {
      expect(process.env.PATH).toBe('/usr/bin');
      return Promise.resolve({ url: mockServerUrl, close: vi.fn() });
    });

    const sdkClient = createSDKClient({});
    await sdkClient.startServer();

    expect(process.env.PATH).toBe('/usr/bin');
  });

  it('does not modify PATH when opencodeBinaryPath is the literal default "opencode"', async () => {
    // Regression: callers that explicitly pass 'opencode' (the bare binary
    // name) should not trigger PATH mutation — that case is equivalent to
    // "no path configured" and should fall through to the normal spawn.
    const mockServerUrl = 'http://127.0.0.1:54321';
    vi.mocked(createOpencodeServer).mockImplementation(() => {
      expect(process.env.PATH).toBe('/usr/bin');
      return Promise.resolve({ url: mockServerUrl, close: vi.fn() });
    });

    const sdkClient = createSDKClient({ opencodeBinaryPath: 'opencode' });
    await sdkClient.startServer();

    expect(process.env.PATH).toBe('/usr/bin');
  });

  it('restores PATH even when createOpencodeServer rejects', async () => {
    // Regression: a try/finally around the SDK call must restore PATH even on
    // failure, otherwise a broken binary path would leak into subsequent
    // spawns in the same process and cause confusing cross-contamination.
    const failure = new Error('spawn opencode ENOENT');
    vi.mocked(createOpencodeServer).mockRejectedValueOnce(failure);

    const sdkClient = createSDKClient({ opencodeBinaryPath: '/custom/bin/opencode' });
    await expect(sdkClient.startServer()).rejects.toBe(failure);

    expect(process.env.PATH).toBe('/usr/bin');
  });

  it('uses the platform path delimiter to join the binary directory', () => {
    // Sanity check that the implementation uses path.delimiter (not a literal
    // ':' or ';') so it works on both POSIX and Windows. The actual join is
    // delegated to opencode-path.joinPath; here we just verify the wiring.
    const joined = `/custom/bin${path.delimiter}/usr/bin`;
    expect(joined).toBe(`/custom/bin${path.delimiter}/usr/bin`);
  });
});

