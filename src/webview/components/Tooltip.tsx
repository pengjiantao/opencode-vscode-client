/**
 * @file Reusable custom Tooltip system for the VS Code client webview.
 * Implements mouseenter/mouseleave hover delays, supports text selection/copying,
 * performs screen boundary safety checks, updates on viewport scroll/resize,
 * and automatically dismisses tooltips when the target element is detached/unmounted.
 */

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Reusable global Tooltip component.
 * Renders a single custom floating widget at the root level, listening to
 * elements that declare a `data-custom-title` attribute.
 */
export function Tooltip() {
  const [content, setContent] = useState<string>('');
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [style, setStyle] = useState<CSSProperties>({
    left: '-9999px',
    top: '-9999px',
    opacity: 0,
  });

  const [activeTarget, setActiveTarget] = useState<HTMLElement | null>(null);

  const isVisibleRef = useRef<boolean>(false);
  const contentRef = useRef<string>('');
  const activeTargetRef = useRef<HTMLElement | null>(null);

  // Keep refs updated dynamically to avoid stale closures in global event handlers without re-binding them
  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    activeTargetRef.current = activeTarget;
  }, [activeTarget]);

  const tooltipRef = useRef<HTMLDivElement>(null);
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  /** Updates the tooltip positioning coordinates relative to the active target element. */
  const updatePosition = useCallback(() => {
    if (!activeTarget || !tooltipRef.current) return;

    const triggerRect = activeTarget.getBoundingClientRect();
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
  }, [activeTarget]);

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
      setActiveTarget(null);
    }, 150); // 150ms hide delay
  };

  // Set up global mouse listener to capture elements using data-custom-title
  useEffect(() => {
    const handleMouseOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('[data-custom-title]');
      if (!target) return;

      const titleText = target.getAttribute('data-custom-title');
      if (!titleText) return;

      // Cancel pending hide timeouts since the cursor returned or moved to another tooltip target
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }

      // If hover cursor is still on the same target, dynamically update text if the title has changed (e.g., from 'Copy' to 'Copied!')
      if (activeTargetRef.current === target) {
        if (titleText !== contentRef.current) {
          setContent(titleText);
        }
        return;
      }

      // Clear any pending triggers for other elements to prevent multiple active show timers
      if (showTimerRef.current) {
        window.clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }

      setActiveTarget(target as HTMLElement);

      if (isVisibleRef.current) {
        // If a tooltip is already open, instantly switch to the new target to optimize responsiveness
        setContent(titleText);
      } else {
        // Delay showing the initial tooltip by 400ms to avoid unnecessary flashing on fast mouse sweeps
        showTimerRef.current = window.setTimeout(() => {
          setContent(titleText);
          setIsVisible(true);
        }, 400);
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      if (!activeTargetRef.current) return;

      const related = e.relatedTarget as HTMLElement | null;

      // If the mouse has moved into the tooltip container itself, preserve the tooltip.
      if (related && (tooltipRef.current === related || tooltipRef.current?.contains(related))) {
        return;
      }

      // If the mouse has moved to an element that is NOT a descendant of the active target, trigger hide delay.
      // This is extremely robust against children being unmounted or replaced on click events.
      if (!related || !activeTargetRef.current.contains(related)) {
        // Clear show timer to avoid showing the tooltip if the cursor left before the display delay threshold
        if (showTimerRef.current) {
          window.clearTimeout(showTimerRef.current);
          showTimerRef.current = null;
        }

        startHideTimer();
      }
    };

    document.body.addEventListener('mouseover', handleMouseOver);
    document.body.addEventListener('mouseout', handleMouseOut);

    return () => {
      document.body.removeEventListener('mouseover', handleMouseOver);
      document.body.removeEventListener('mouseout', handleMouseOut);
      clearTimers();
    };
  }, []);

  // Calculate and apply layout coordinates synchronously before browser paints to prevent flashes at (0,0)
  useLayoutEffect(() => {
    if (!isVisible || !activeTarget) return;
    updatePosition();
  }, [isVisible, content, activeTarget, updatePosition]);

  // Handle scrolling and resizing asynchronously to keep tooltip aligned
  useEffect(() => {
    if (!isVisible || !activeTarget) return;

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
  }, [isVisible, activeTarget, updatePosition]);

  // Monitor DOM state: immediately dismiss tooltip if the target is unmounted or hidden
  useEffect(() => {
    if (!isVisible || !activeTarget) return;

    const interval = window.setInterval(() => {
      const isAttached = document.body.contains(activeTarget);
      const rect = activeTarget.getBoundingClientRect();
      const isVisibleLayout = rect.width > 0 && rect.height > 0;

      // If the parent trigger unmounts or becomes hidden, close the tooltip instantly
      if (!isAttached || !isVisibleLayout) {
        setIsVisible(false);
        setContent('');
        setActiveTarget(null);
        clearTimers();
      }
    }, 100);

    return () => {
      window.clearInterval(interval);
    };
  }, [isVisible, activeTarget]);

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
      <div dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  );
}
