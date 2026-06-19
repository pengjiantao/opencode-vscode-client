/**
 * @file VS Code extension configuration management module.
 * Provides unified type-safe accessors and type support for opencode configuration settings.
 */

import { workspace } from 'vscode';
import { DEFAULT_HISTORY_SIZE } from '../../shared/promptHistory';

export { DEFAULT_HISTORY_SIZE };

/**
 * Default server start timeout in milliseconds.
 * Low-spec machines may need a higher value (e.g. 30000–60000).
 */
export const DEFAULT_SERVER_TIMEOUT = 15000;

const SERVER_TIMEOUT_MIN = 5000;
const SERVER_TIMEOUT_MAX = 120000;

/**
 * Interface representing the strongly-typed settings structure of the extension.
 */
export interface ExtensionConfig {
  /** Default provider/model to use */
  model: string;
  /** Default agent to use */
  agent: string;
  /**
   * Maximum number of prompts retained in input history (Up/Down recall).
   * Clamped to `[1, 500]`. Defaults to {@link DEFAULT_HISTORY_SIZE}.
   */
  historySize: number;
  /**
   * Timeout in milliseconds for the opencode server to start.
   * Clamped to `[5000, 120000]`. Defaults to {@link DEFAULT_SERVER_TIMEOUT}.
   */
  serverTimeout: number;
  /**
   * Absolute path to the opencode executable. Empty string (default) means
   * resolve `opencode` from PATH. When set, the directory of this path is
   * prepended to PATH so the SDK's hard-coded binary lookup succeeds. The
   * binary must be named `opencode` (or `opencode.exe` on Windows).
   */
  executablePath: string;
}

/** Supported configuration keys that can be written. */
export type ConfigKey = keyof ExtensionConfig;

const HISTORY_SIZE_MIN = 1;
const HISTORY_SIZE_MAX = 500;

/**
 * Coerces a raw configuration value into a valid `historySize`.
 * `null`, `undefined`, NaN, non-finite, and out-of-range inputs fall back to
 * the default.
 *
 * @param value The raw value from `workspace.getConfiguration`.
 * @returns A clamped, finite positive integer.
 */
export function clampHistorySize(value: unknown): number {
  if (value === null || value === undefined) return DEFAULT_HISTORY_SIZE;
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_HISTORY_SIZE;
  return Math.min(HISTORY_SIZE_MAX, Math.max(HISTORY_SIZE_MIN, Math.floor(n)));
}

/**
 * Coerces a raw configuration value into a valid `serverTimeout`.
 * Falls back to {@link DEFAULT_SERVER_TIMEOUT} on invalid input.
 *
 * @param value The raw value from `workspace.getConfiguration`.
 * @returns A clamped, finite positive integer in milliseconds.
 */
export function clampServerTimeout(value: unknown): number {
  if (value === null || value === undefined) return DEFAULT_SERVER_TIMEOUT;
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SERVER_TIMEOUT;
  // Floor keeps fractional settings on whole-millisecond boundaries; clamping enforces bounds.
  return Math.min(SERVER_TIMEOUT_MAX, Math.max(SERVER_TIMEOUT_MIN, Math.floor(n)));
}

/**
 * Retrieves the current unified extension configurations from vscode workspace settings.
 *
 * @returns The resolved type-safe ExtensionConfig object.
 */
export function getConfiguration(): ExtensionConfig {
  const config = workspace.getConfiguration('opencode');
  return {
    model: config.get<string>('model', ''),
    agent: config.get<string>('agent', ''),
    historySize: clampHistorySize(config.get<number>('historySize', DEFAULT_HISTORY_SIZE)),
    serverTimeout: clampServerTimeout(config.get<number>('serverTimeout', DEFAULT_SERVER_TIMEOUT)),
    executablePath: config.get<string>('executablePath', ''),
  };
}

/**
 * Updates a single opencode configuration value and persists it.
 *
 * @param key The configuration key to update.
 * @param value The new value to set.
 */
export function setConfiguration<K extends ConfigKey>(key: K, value: ExtensionConfig[K]): void {
  const config = workspace.getConfiguration('opencode');
  void config.update(key, value, true);
}
