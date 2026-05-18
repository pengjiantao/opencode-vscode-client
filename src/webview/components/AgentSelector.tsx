/**
 * @file Dropdown selector component for choosing an AI agent.
 * Filters out subagents and hidden agents, showing only primary agents.
 */

import { Codicon } from './Codicon';
import { Select } from './Select';

/** Structure representing an Agent object. */
export interface Agent {
  /** Unique agent identifier. */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Run mode (e.g. 'subagent', 'primary'). */
  mode?: string;
  /** If true, the agent is hidden from standard selectors. */
  hidden?: boolean;
}

/** Props for the AgentSelector component. */
export interface AgentSelectorProps {
  /** Array of all available AI agents. */
  agents: Agent[];
  /** ID of the currently selected agent. */
  value: string;
  /** Callback fired when a new agent is selected. */
  onChange: (agent: string) => void;
}

/** Custom selector dropdown for choosing among available primary agents. */
export function AgentSelector({ agents, value, onChange }: AgentSelectorProps) {
  const isLoading = agents.length === 0;

  // Filter agents to only show primary type agents (mode !== 'subagent' and not hidden)
  const primaryAgents = agents.filter((a) => {
    if (a.mode !== undefined) {
      return a.mode !== 'subagent' && !a.hidden;
    }
    // Fallback default list if mode not provided: build, plan
    return a.id === 'build' || a.id === 'plan';
  });

  // Map Agent items to generic SelectOption format
  const options = primaryAgents.map((a) => ({
    id: a.id,
    label: a.name,
  }));

  const activeAgent = primaryAgents.find((a) => a.id === value) || primaryAgents[0];
  const triggerText = activeAgent ? activeAgent.name : value || 'Select agent...';
  const icon =
    activeAgent?.id === 'plan' ? <Codicon name="notebook" /> : <Codicon name="terminal" />;

  return (
    <Select
      ariaLabel="Select agent"
      options={options}
      value={value}
      onChange={onChange}
      triggerText={triggerText}
      icon={icon}
      isLoading={isLoading}
      loadingText="Loading agents..."
      noResultsText="No agents found"
      placement="top"
      className="agent-selector-container"
      popoverClassName="agent-popover"
    />
  );
}
