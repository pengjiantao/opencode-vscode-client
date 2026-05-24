/**
 * @file Renders the custom bash execution output with a terminal-like header and an auto-anchoring scroll container.
 */

import { useEffect, useRef } from 'react';
import { Codicon } from '../Codicon';

export interface BashOutputProps {
  /** The executed command string. */
  command: string;
  /** The accumulated output to display. */
  output: string;
  /** The execution status of the tool call. */
  status: 'pending' | 'running' | 'completed' | 'error';
}

/**
 * Renders the custom bash execution output with a terminal-like header and an auto-anchoring scroll container.
 * Auto-scroll is only triggered when the user is already near the bottom (within 40px margin of error)
 * so we don't disrupt the user if they've manually scrolled up to inspect previous output.
 * If the command is running, shows the loading/thinking spinner icon; once completed or errored, the icon is hidden.
 */
export function BashOutput({ command, output, status }: BashOutputProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Check if the user is already near the bottom before scrolling
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 40;
    if (isAtBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [output]);

  if (!output) {
    return null;
  }

  const showIcon = status === 'running';

  return (
    <div className="tool-bash-output">
      <div className="bash-output-header">
        {showIcon && <Codicon name="$(sync~spin)" className="bash-output-icon" />}
        <span className="bash-output-command" title={command}>
          {command}
        </span>
      </div>
      <div className="bash-output-scroll" ref={scrollRef}>
        <pre>{output}</pre>
      </div>
    </div>
  );
}
