/**
 * @file Collapsible reasoning/thinking block that shows the model's chain-of-thought and thinking duration.
 */

import { useEffect, useState } from 'react';
import { Codicon } from '../Codicon';
import { Markdown } from '../Markdown';
import { ScrollFadeContainer } from '../ScrollFadeContainer';

interface ReasoningPartProps {
  text: string;
  time?: { start: number; end?: number };
  metadata?: Record<string, unknown>;
  hasPredecessor?: boolean;
  hasSuccessor?: boolean;
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
export function ReasoningPart({
  text,
  time,
  hasPredecessor = false,
  hasSuccessor = false,
}: ReasoningPartProps) {
  const hasEnd = time?.end !== undefined;
  const [collapsed, setCollapsed] = useCollapseOnComplete(hasEnd);
  // Spinner icon during running state, static idea lightbulb on complete
  const iconName = hasEnd ? '$(lightbulb)' : '$(sync~spin)';

  // Show progress state while active, and transition to precise elapsed duration when complete.
  const getDurationText = () => {
    if (time?.end && time?.start) {
      const duration = ((time.end - time.start) / 1000).toFixed(1);
      return `Thought for ${duration}s`;
    }
    return 'Thinking...';
  };

  const dotClassName = `timeline-dot reasoning-dot${!hasEnd ? ' status-running' : ''}`;
  const showLine = hasPredecessor || hasSuccessor;

  return (
    <div className={`part reasoning-part timeline-item ${collapsed ? 'collapsed' : 'expanded'}`}>
      <span className={dotClassName} />
      {showLine && (
        <span
          className={`timeline-line${hasPredecessor ? ' has-predecessor' : ''}${hasSuccessor ? ' has-successor' : ''}`}
        />
      )}
      <div className="reasoning-header" onClick={() => setCollapsed(!collapsed)}>
        <Codicon name={iconName} className="reasoning-header-icon" />
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
        <ScrollFadeContainer
          contentClassName="reasoning-content"
          autoScroll={true}
          dependencies={[text]}
        >
          <Markdown text={text} />
        </ScrollFadeContainer>
      </div>
    </div>
  );
}
