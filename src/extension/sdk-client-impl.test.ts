/**
 * @file Unit tests for sdk-client-impl.ts.
 * Verifies that createSDKClient startServer invokes createOpencodeServer with port 0
 * and initializes the client correctly with the spawned server's URL.
 */

import { createOpencodeServer } from '@opencode-ai/sdk';
import { createOpencodeClient } from '@opencode-ai/sdk/v2/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSDKClient } from './sdk-client-impl';

vi.mock('@opencode-ai/sdk', () => ({
  createOpencodeServer: vi.fn(),
}));

vi.mock('@opencode-ai/sdk/v2/client', () => ({
  createOpencodeClient: vi.fn().mockImplementation(() => ({
    session: {
      list: vi.fn().mockResolvedValue({ data: [] }),
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

    const sdkClient = createSDKClient('/mock/workspace');
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
});
