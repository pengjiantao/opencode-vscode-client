/**
 * @file Collapsible reasoning/thinking block that shows the model's chain-of-thought and thinking duration.
 */

import { useEffect, useState } from 'react';
import { Markdown } from '../Markdown';

interface ReasoningPartProps {
  text: string;
  time?: { start: number; end?: number };
  metadata?: Record<string, unknown>;
}

/**
 * Custom hook to manage collapsed state during completion transitions.
 * Syncs the collapsed state with the model completion lifecycle.
 * When the model completes its thinking process (hasEnd becomes true),
 * it automatically triggers the section to collapse.
 */
function useCollapseOnComplete(hasEnd: boolean) {
  const [collapsed, setCollapsed] = useState(hasEnd);

  useEffect(() => {
    if (hasEnd) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setCollapsed(true);
    }
  }, [hasEnd]);

  return [collapsed, setCollapsed] as const;
}

/** Collapsible section displaying the model's internal reasoning text and duration. */
export function ReasoningPart({ text, time }: ReasoningPartProps) {
  const hasEnd = time?.end !== undefined;
  const [collapsed, setCollapsed] = useCollapseOnComplete(hasEnd);

  const getDurationText = () => {
    if (time?.end && time?.start) {
      const duration = ((time.end - time.start) / 1000).toFixed(1);
      return `Thought for ${duration}s`;
    }
    return 'Thinking...';
  };

  return (
    <div className={`part reasoning-part ${collapsed ? 'collapsed' : 'expanded'}`}>
      <div className="reasoning-header" onClick={() => setCollapsed(!collapsed)}>
        <span className="reasoning-label">{getDurationText()}</span>
      </div>
      <div
        className="collapsible-wrapper"
        style={{
          maxHeight: collapsed ? 0 : '1000px',
          opacity: collapsed ? 0 : 1,
          overflow: 'hidden',
        }}
      >
        <div className="reasoning-content">
          <Markdown text={text} />
        </div>
      </div>
    </div>
  );
}
