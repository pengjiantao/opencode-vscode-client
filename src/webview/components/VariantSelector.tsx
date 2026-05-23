/**
 * @file Dropdown selector component for choosing a model variant (reasoning configuration).
 * Allows choosing default or model-specific reasoning profiles (e.g. low, medium, high).
 */

import { Codicon } from './Codicon';
import { Select } from './Select';

/** Props for the VariantSelector component. */
export interface VariantSelectorProps {
  /** Array of available model variant names. */
  variants: string[];
  /** The currently active variant. */
  value: string;
  /** Callback fired when a new variant is selected. */
  onChange: (variant: string) => void;
}

/** Combobox dropdown for selecting a variant reasoning level, styled for VS Code client. */
export function VariantSelector({ variants, value, onChange }: VariantSelectorProps) {
  const resolvedTriggerText = value === 'default' ? 'Default' : value || 'Default';

  // Construct options list including Default option (which maps to 'default')
  const options = [
    { id: 'default', label: 'Default' },
    ...variants.map((v) => ({ id: v, label: v })),
  ];

  return (
    <Select
      ariaLabel="Select model variant"
      options={options}
      value={value}
      onChange={onChange}
      placeholder="Select variant..."
      searchable={false}
      triggerText={resolvedTriggerText}
      icon={<Codicon name="zap" />}
      placement="top"
      className="variant-selector-container"
      popoverClassName="variant-popover"
    />
  );
}
