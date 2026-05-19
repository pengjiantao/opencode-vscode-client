/**
 * @file Unit tests for config.ts.
 * Verifies getConfiguration behaves correctly and maps vscode workspace configuration options.
 */

import { describe, expect, it, vi } from 'vitest';
import { workspace, WorkspaceConfiguration } from 'vscode';
import { getConfiguration } from './config';

vi.mock('vscode', () => {
  const getMock = vi.fn((key: string, defaultValue: unknown) => defaultValue);
  const getConfigurationMock = vi.fn(() => ({
    get: getMock,
  }));
  return {
    workspace: {
      getConfiguration: getConfigurationMock,
    },
  };
});

describe('config', () => {
  it('should return default values when config values are not set', () => {
    const config = getConfiguration();
    expect(config.model).toBe('');
    expect(config.agent).toBe('');
    expect(config.maxCacheFiles).toBe(2000);
  });

  it('should return configured values when set in workspace properties', () => {
    const workspaceMock = vi.mocked(workspace.getConfiguration);
    const mockGet = vi.fn().mockImplementation((key: string, defaultValue: unknown) => {
      if (key === 'model') return 'provider/model-x';
      if (key === 'agent') return 'agent-y';
      if (key === 'maxCacheFiles') return 100;
      return defaultValue;
    });
    workspaceMock.mockReturnValueOnce({
      get: mockGet,
    } as unknown as WorkspaceConfiguration);

    const config = getConfiguration();
    expect(config.model).toBe('provider/model-x');
    expect(config.agent).toBe('agent-y');
    expect(config.maxCacheFiles).toBe(100);
  });
});
