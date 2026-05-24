/**
 * @file Shared helpers for choosing language model defaults from provider metadata.
 */

import type { ModelInfo } from './types';

/** Returns whether a model should be treated as available for user selection. */
export function isConnectedModel(model: ModelInfo): boolean {
  return model.isConnected !== false;
}

/**
 * Resolves the default model ID, preferring connected providers before falling back to any model.
 *
 * @param models Available SDK model metadata.
 * @returns A model ID or an empty string when no models are known.
 */
export function resolveDefaultModelId(models: readonly ModelInfo[]): string {
  return models.find(isConnectedModel)?.id ?? models[0]?.id ?? '';
}
