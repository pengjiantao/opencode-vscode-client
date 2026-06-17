/**
 * @file Unit tests for config.ts.
 * Verifies getConfiguration behaves correctly and maps vscode workspace configuration options.
 */

import { describe, expect, it, vi } from 'vitest';
import { workspace, WorkspaceConfiguration } from 'vscode';
import {
  clampHistorySize,
  clampServerTimeout,
  DEFAULT_HISTORY_SIZE,
  DEFAULT_SERVER_TIMEOUT,
  getConfiguration,
  setConfiguration,
} from './config';

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
    expect(config.historySize).toBe(DEFAULT_HISTORY_SIZE);
  });

  it('should return configured values when set in workspace properties', () => {
    const workspaceMock = vi.mocked(workspace.getConfiguration);
    const mockGet = vi.fn().mockImplementation((key: string, defaultValue: unknown) => {
      if (key === 'model') return 'provider/model-x';
      if (key === 'agent') return 'agent-y';
      if (key === 'historySize') return 25;
      return defaultValue;
    });
    workspaceMock.mockReturnValueOnce({
      get: mockGet,
      update: updateMock,
    } as unknown as WorkspaceConfiguration);

    const config = getConfiguration();
    expect(config.model).toBe('provider/model-x');
    expect(config.agent).toBe('agent-y');
    expect(config.historySize).toBe(25);
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

describe('clampHistorySize', () => {
  it('returns the default for non-finite or missing values', () => {
    expect(clampHistorySize(undefined)).toBe(DEFAULT_HISTORY_SIZE);
    expect(clampHistorySize(null)).toBe(DEFAULT_HISTORY_SIZE);
    expect(clampHistorySize('not-a-number')).toBe(DEFAULT_HISTORY_SIZE);
    expect(clampHistorySize(NaN)).toBe(DEFAULT_HISTORY_SIZE);
  });

  it('clamps to the configured minimum and maximum', () => {
    expect(clampHistorySize(0)).toBe(1);
    expect(clampHistorySize(-5)).toBe(1);
    expect(clampHistorySize(1000)).toBe(500);
  });

  it('floors fractional values', () => {
    expect(clampHistorySize(10.9)).toBe(10);
  });

  it('passes through valid integers unchanged', () => {
    expect(clampHistorySize(1)).toBe(1);
    expect(clampHistorySize(50)).toBe(50);
    expect(clampHistorySize(500)).toBe(500);
  });
});

describe('clampServerTimeout', () => {
  it('returns the default for non-finite or missing values', () => {
    expect(clampServerTimeout(undefined)).toBe(DEFAULT_SERVER_TIMEOUT);
    expect(clampServerTimeout(null)).toBe(DEFAULT_SERVER_TIMEOUT);
    expect(clampServerTimeout('not-a-number')).toBe(DEFAULT_SERVER_TIMEOUT);
    expect(clampServerTimeout(NaN)).toBe(DEFAULT_SERVER_TIMEOUT);
  });

  it('clamps to the configured minimum and maximum', () => {
    expect(clampServerTimeout(0)).toBe(5000);
    expect(clampServerTimeout(-5)).toBe(5000);
    expect(clampServerTimeout(1000)).toBe(5000);
    expect(clampServerTimeout(999999)).toBe(120000);
  });

  it('floors fractional values', () => {
    expect(clampServerTimeout(15000.9)).toBe(15000);
  });

  it('passes through valid integers unchanged', () => {
    expect(clampServerTimeout(5000)).toBe(5000);
    expect(clampServerTimeout(30000)).toBe(30000);
    expect(clampServerTimeout(120000)).toBe(120000);
  });
});
