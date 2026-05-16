import { VSCodeDropdown, VSCodeOption } from '@vscode/webview-ui-toolkit/react';

interface ModelSelectorProps {
  models: Array<{ id: string; name: string }>;
  value: string;
  onChange: (model: string) => void;
}

export function ModelSelector({ models, value, onChange }: ModelSelectorProps) {
  if (models.length === 0) {
    return (
      <VSCodeDropdown
        aria-label="Select model"
        onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
        disabled
      >
        <VSCodeOption value="">Loading models...</VSCodeOption>
      </VSCodeDropdown>
    );
  }

  return (
    <VSCodeDropdown
      aria-label="Select model"
      value={value}
      onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
    >
      {models.map((m) => (
        <VSCodeOption key={m.id} value={m.id}>
          {m.name}
        </VSCodeOption>
      ))}
    </VSCodeDropdown>
  );
}
