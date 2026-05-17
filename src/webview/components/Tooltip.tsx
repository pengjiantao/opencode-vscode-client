/**
 * @file Reusable custom Tooltip system for the VS Code client webview.
 * Implements mouseenter/mouseleave hover delays, supports text selection/copying,
 * performs screen boundary safety checks, updates on viewport scroll/resize,
 * and automatically dismisses tooltips when the target element is detached/unmounted.
 */

import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';

/**
 * Reusable global Tooltip component.
 * Renders a single custom floating widget at the root level, listening to
 * elements that declare a `data-custom-title` attribute.
 */
export function Tooltip() {
  const [content, setContent] = useState<string>('');
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [style, setStyle] = useState<CSSProperties>({
    left: '0px',
    top: '0px',
    opacity: 0,
  });

  const tooltipRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  /** Updates the tooltip positioning coordinates relative to the active target element. */
  const updatePosition = () => {
    if (!targetRef.current || !tooltipRef.current) return;

    const triggerRect = targetRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    // Standard behavior: center horizontally, align 8px above target element
    let left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
    let top = triggerRect.top - tooltipRect.height - 8;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Viewport collision checking: if space is limited on top, display below the target
    if (top < 8) {
      top = triggerRect.bottom + 8;
    }

    // Keep horizontal coordinate strictly within viewport margins
    left = Math.max(8, Math.min(left, viewportWidth - tooltipRect.width - 8));

    // Keep vertical coordinate strictly within viewport margins
    top = Math.max(8, Math.min(top, viewportHeight - tooltipRect.height - 8));

    setStyle({
      left: `${left}px`,
      top: `${top}px`,
    });
  };

  /** Clears all pending show and hide timeout triggers. */
  const clearTimers = () => {
    if (showTimerRef.current) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  /** Initiates the delayed disappear animation/hiding flow. */
  const startHideTimer = () => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(() => {
      setIsVisible(false);
      setContent('');
      targetRef.current = null;
    }, 250); // 250ms hide delay
  };

  // Set up global mouse listener to capture elements using data-custom-title
  useEffect(() => {
    const handleMouseOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('[data-custom-title]');
      if (!target) return;

      const titleText = target.getAttribute('data-custom-title');
      if (!titleText) return;

      // Cancel pending hide timeouts if cursor moves back to target
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }

      // If we are already displaying/preparing for this target, do nothing
      if (targetRef.current === target) {
        return;
      }

      // Clear any pending triggers for other elements
      if (showTimerRef.current) {
        window.clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }

      targetRef.current = target as HTMLElement;

      // Start the show timer (400ms display delay)
      showTimerRef.current = window.setTimeout(() => {
        setContent(titleText);
        setIsVisible(true);
      }, 400);
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('[data-custom-title]');
      if (!target || targetRef.current !== target) return;

      // Clear show timer in case mouse leaves quickly before delay threshold
      if (showTimerRef.current) {
        window.clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }

      startHideTimer();
    };

    document.body.addEventListener('mouseover', handleMouseOver);
    document.body.addEventListener('mouseout', handleMouseOut);

    return () => {
      document.body.removeEventListener('mouseover', handleMouseOver);
      document.body.removeEventListener('mouseout', handleMouseOut);
      clearTimers();
    };
  }, []);

  // Update layout positions on rendering, scroll events, or resize changes
  useEffect(() => {
    if (!isVisible) return;

    // Perform an initial positioning calculation
    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    // Capture scrolling on any nested elements (like the chat view container)
    window.addEventListener('scroll', handleScrollOrResize, { capture: true, passive: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, { capture: true });
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isVisible, content]);

  // Monitor DOM state: immediately dismiss tooltip if the target is unmounted or hidden
  useEffect(() => {
    if (!isVisible) return;

    const interval = window.setInterval(() => {
      if (!targetRef.current) return;

      const isAttached = document.body.contains(targetRef.current);
      const rect = targetRef.current.getBoundingClientRect();
      const isVisibleLayout = rect.width > 0 && rect.height > 0;

      // If the parent trigger unmounts or becomes hidden, close the tooltip instantly
      if (!isAttached || !isVisibleLayout) {
        setIsVisible(false);
        setContent('');
        targetRef.current = null;
        clearTimers();
      }
    }, 100);

    return () => {
      window.clearInterval(interval);
    };
  }, [isVisible]);

  // Event handlers to preserve tooltip when mouse enters it directly (copy-friendly)
  const handleTooltipMouseEnter = () => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const handleTooltipMouseLeave = () => {
    startHideTimer();
  };

  if (!isVisible) return null;

  return (
    <div
      ref={tooltipRef}
      className={`custom-tooltip-container tooltip-visible`}
      style={style}
      onMouseEnter={handleTooltipMouseEnter}
      onMouseLeave={handleTooltipMouseLeave}
      data-testid="custom-tooltip"
    >
      {content}
    </div>
  );
}
