/**
 * @file Collapsible reasoning/thinking block that shows the model's chain-of-thought.
 */

import { useState } from 'react';
import { Codicon } from '../Codicon';

interface ReasoningPartProps {
  text: string;
  metadata?: Record<string, unknown>;
}

/** Collapsible section displaying the model's internal reasoning text. */
export function ReasoningPart({ text }: ReasoningPartProps) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className={`part reasoning-part ${collapsed ? 'collapsed' : 'expanded'}`}>
      <div className="reasoning-header" onClick={() => setCollapsed(!collapsed)}>
        <span className="collapse-icon">
          <Codicon name={collapsed ? '$(chevron-right)' : '$(chevron-down)'} />
        </span>
        <span className="reasoning-label">Thinking</span>
      </div>
      {!collapsed && (
        <div className="reasoning-content">
          <pre>{text}</pre>
        </div>
      )}
    </div>
  );
}
