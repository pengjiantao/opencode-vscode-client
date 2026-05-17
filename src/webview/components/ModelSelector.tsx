/**
 * @file Dropdown selector component for choosing a language model.
 * Supports search, grouping by provider, and filtering disconnected models.
 */

import { Select } from './Select';

/** Structure representing a language model. */
export interface Model {
  /** Unique model identifier. */
  id: string;
  /** Human-readable model name. */
  name: string;
  /** Unique identifier for the provider (optional). */
  providerId?: string;
  /** Display name of the provider (optional). */
  providerName?: string;
  /** If false, the model connection is disabled or disconnected. */
  isConnected?: boolean;
}

/** Props for the ModelSelector component. */
export interface ModelSelectorProps {
  /** Array of available language models. */
  models: Model[];
  /** ID of the currently selected model. */
  value: string;
  /** Callback fired when a new model is selected. */
  onChange: (model: string) => void;
}

/** Searchable combobox for selecting a model, grouped by provider. */
export function ModelSelector({ models, value, onChange }: ModelSelectorProps) {
  const isLoading = models.length === 0;

  // Find currently active model for trigger display text
  const activeModel = models.find((m) => m.id === value);
  const triggerText = activeModel
    ? activeModel.providerName
      ? `${activeModel.providerName}: ${activeModel.name}`
      : activeModel.name
    : value || 'Select model...';

  // Only show connected models in the dropdown
  const configuredModels = models.filter((m) => m.isConnected !== false);

  // Map Model items to generic SelectOption format
  const options = configuredModels.map((m) => ({
    id: m.id,
    label: m.name,
    group: m.providerName || 'Other',
  }));

  return (
    <Select
      ariaLabel="Select model"
      options={options}
      value={value}
      onChange={onChange}
      placeholder="Search models..."
      searchable={true}
      triggerText={triggerText}
      isLoading={isLoading}
      loadingText="Loading models..."
      noResultsText="No models found"
      placement="top"
      className="model-selector-container"
      popoverClassName="model-popover"
    />
  );
}
