/**
 * @file Animated 3-dot indicator shown while the assistant is processing.
 * Dots light up sequentially from left to right in a ripple pattern,
 * aligned on the x-axis with the timeline dots in tool/reasoning parts.
 */

/**
 * Renders three animated dots as a "thinking" indicator.
 * Displayed whenever the session is busy (isGenerating) to show
 * the agent is still working, regardless of whether parts exist.
 */
export function ThinkingDots() {
  return (
    <div className="thinking-dots" aria-label="Thinking">
      <span className="dot dot-1" style={{ animationDelay: '0s' }} />
      <span className="dot dot-2" style={{ animationDelay: '0.2s' }} />
      <span className="dot dot-3" style={{ animationDelay: '0.4s' }} />
    </div>
  );
}
