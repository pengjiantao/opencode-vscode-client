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
  /** Maximum number of files to index in workspace cache */
  maxCacheFiles: number;
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
    maxCacheFiles: config.get<number>('maxCacheFiles', 2000),
  };
}
