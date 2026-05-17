/**
 * @file Dropdown selector component for choosing an AI agent.
 * Filters out subagents and hidden agents, showing only primary agents.
 */

import { useEffect, useRef, useState } from 'react';

interface Agent {
  id: string;
  name: string;
  mode?: string;
  hidden?: boolean;
}

interface AgentSelectorProps {
  agents: Array<Agent>;
  value: string;
  onChange: (agent: string) => void;
}

/** Custom combobox for selecting among available primary agents. */
export function AgentSelector({ agents, value, onChange }: AgentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isLoading = agents.length === 0;

  // Filter agents to only show primary type agents (mode !== 'subagent' and not hidden)
  const primaryAgents = agents.filter((a) => {
    if (a.mode !== undefined) {
      return a.mode !== 'subagent' && !a.hidden;
    }
    // Fallback default list if mode not provided: build, plan
    return a.id === 'build' || a.id === 'plan';
  });

  const activeAgent = primaryAgents.find((a) => a.id === value) || primaryAgents[0];
  const triggerText = activeAgent ? activeAgent.name : value || 'Select agent...';

  return (
    <div className="custom-select-container" ref={containerRef}>
      <button
        role="combobox"
        aria-label="Select agent"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={isLoading}
        className="custom-select-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="trigger-text">{isLoading ? 'Loading agents...' : triggerText}</span>
        <span className="chevron-icon">▼</span>
      </button>

      {isOpen && !isLoading && (
        <div className="custom-select-popover agent-popover">
          <div className="popover-options-list" role="listbox">
            {primaryAgents.length === 0 ? (
              <div className="popover-no-results">No agents found</div>
            ) : (
              primaryAgents.map((a) => (
                <div
                  key={a.id}
                  role="option"
                  aria-selected={a.id === value}
                  className={`popover-option ${a.id === value ? 'selected' : ''}`}
                  onClick={() => {
                    onChange(a.id);
                    setIsOpen(false);
                  }}
                >
                  <span className="option-name">{a.name}</span>
                  {a.id === value && <span className="check-icon">✓</span>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
