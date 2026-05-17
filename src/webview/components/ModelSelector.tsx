import { useEffect, useRef, useState } from 'react';

interface Model {
  id: string;
  name: string;
  providerId?: string;
  providerName?: string;
  isConnected?: boolean;
}

interface ModelSelectorProps {
  models: Array<Model>;
  value: string;
  onChange: (model: string) => void;
}

export function ModelSelector({ models, value, onChange }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isLoading = models.length === 0;

  // Find currently active model
  const activeModel = models.find((m) => m.id === value);
  const triggerText = activeModel
    ? activeModel.providerName
      ? `${activeModel.providerName}: ${activeModel.name}`
      : activeModel.name
    : value || 'Select model...';

  // Filter models that are connected (isConnected is not false)
  const configuredModels = models.filter((m) => m.isConnected !== false);

  // Filter based on search query
  const filteredModels = configuredModels.filter((m) => {
    const term = searchQuery.toLowerCase();
    return (
      m.name.toLowerCase().includes(term) ||
      (m.providerName && m.providerName.toLowerCase().includes(term))
    );
  });

  // Group by providerName
  const grouped: Record<string, Array<Model>> = {};
  filteredModels.forEach((m) => {
    const groupName = m.providerName || 'Other';
    if (!grouped[groupName]) {
      grouped[groupName] = [];
    }
    grouped[groupName].push(m);
  });

  return (
    <div className="custom-select-container" ref={containerRef}>
      <button
        role="combobox"
        aria-label="Select model"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={isLoading}
        className="custom-select-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="trigger-text">{isLoading ? 'Loading models...' : triggerText}</span>
        <span className="chevron-icon">▼</span>
      </button>

      {isOpen && !isLoading && (
        <div className="custom-select-popover model-popover">
          <div className="popover-search-container">
            <input
              type="text"
              className="popover-search-input"
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
          <div className="popover-options-list" role="listbox">
            {Object.keys(grouped).length === 0 ? (
              <div className="popover-no-results">No models found</div>
            ) : (
              Object.entries(grouped).map(([providerName, providerModels]) => (
                <div
                  key={providerName}
                  className="popover-group"
                  role="group"
                  aria-label={providerName}
                >
                  <div className="popover-group-header">{providerName}</div>
                  {providerModels.map((m) => (
                    <div
                      key={m.id}
                      role="option"
                      aria-selected={m.id === value}
                      className={`popover-option ${m.id === value ? 'selected' : ''}`}
                      onClick={() => {
                        onChange(m.id);
                        setIsOpen(false);
                        setSearchQuery('');
                      }}
                    >
                      <span className="option-name">{m.name}</span>
                      {m.id === value && <span className="check-icon">✓</span>}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
