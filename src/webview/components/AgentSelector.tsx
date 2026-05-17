import { VSCodeDropdown, VSCodeOption } from '@vscode/webview-ui-toolkit/react';

interface AgentSelectorProps {
  agents: Array<{ id: string; name: string }>;
  value: string;
  onChange: (agent: string) => void;
}

export function AgentSelector({ agents, value, onChange }: AgentSelectorProps) {
  const isLoading = agents.length === 0;

  return (
    <VSCodeDropdown
      aria-label="Select agent"
      value={value}
      onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
      disabled={isLoading}
    >
      {isLoading ? (
        <VSCodeOption value="">Loading agents...</VSCodeOption>
      ) : (
        agents.map((a) => (
          <VSCodeOption key={a.id} value={a.id}>
            {a.name}
          </VSCodeOption>
        ))
      )}
    </VSCodeDropdown>
  );
}
