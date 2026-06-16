/**
 * @file VS Code extension configuration management module.
 * Provides unified type-safe accessors and type support for opencode configuration settings.
 */

import { workspace } from 'vscode';
import { DEFAULT_HISTORY_SIZE } from '../../shared/promptHistory';

export { DEFAULT_HISTORY_SIZE };

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
