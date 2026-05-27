/**
 * @file Unit tests for config.ts.
 * Verifies getConfiguration behaves correctly and maps vscode workspace configuration options.
 */

import { describe, expect, it, vi } from 'vitest';
import { workspace, WorkspaceConfiguration } from 'vscode';
import { getConfiguration, setConfiguration } from './config';

const updateMock = vi.fn();

vi.mock('vscode', () => {
  const getMock = vi.fn((key: string, defaultValue: unknown) => defaultValue);
  const getConfigurationMock = vi.fn(() => ({
    get: getMock,
    update: updateMock,
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
      update: updateMock,
    } as unknown as WorkspaceConfiguration);

    const config = getConfiguration();
    expect(config.model).toBe('provider/model-x');
    expect(config.agent).toBe('agent-y');
    expect(config.maxCacheFiles).toBe(100);
  });

  it('should call config.update with correct arguments for setConfiguration', () => {
    setConfiguration('model', 'anthropic/claude-sonnet-4-20250514');
    expect(updateMock).toHaveBeenCalledWith('model', 'anthropic/claude-sonnet-4-20250514', true);
  });

  it('should clear a configuration value when set to empty string', () => {
    setConfiguration('agent', '');
    expect(updateMock).toHaveBeenCalledWith('agent', '', true);
  });
});
