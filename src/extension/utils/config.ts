/**
 * @file VS Code extension configuration management module.
 * Provides unified type-safe accessors and type support for opencode configuration settings.
 */

import { workspace } from 'vscode';

/**
 * Interface representing the strongly-typed settings structure of the extension.
 */
export interface ExtensionConfig {
  /** Default provider/model to use */
  model: string;
  /** Default agent to use */
  agent: string;
}

/** Supported configuration keys that can be written. */
export type ConfigKey = keyof ExtensionConfig;

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
