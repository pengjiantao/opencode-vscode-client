/**
 * @file Reusable scrolling container with optional auto-scroll and top/bottom gradient shadows (fading effects).
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

const BOTTOM_THRESHOLD_PX = 10;
const AUTO_SCROLL_SETTLE_FRAMES = 3;

type UserScrollDirection = 'none' | 'up' | 'down' | 'unknown';

function isAtBottom(container: HTMLElement): boolean {
  return (
    container.scrollHeight - container.scrollTop - container.clientHeight <= BOTTOM_THRESHOLD_PX
  );
}

function scrollToBottom(container: HTMLElement): void {
  container.scrollTop = container.scrollHeight;
}

/** Props for the ScrollFadeContainer component. */
export interface ScrollFadeContainerProps {
  /** The content to be scrolled. */
  children: React.ReactNode;
  /** Optional extra CSS class name for the outer container wrapper. */
  className?: string;
  /** Optional extra CSS class name for the inner scrollable container. */
  contentClassName?: string;
  /** Whether to automatically scroll to the bottom when children or dependencies update. */
  autoScroll?: boolean;
  /** Dependencies that trigger checking/auto-scrolling (e.g., messages, chat turns). */
  dependencies?: unknown[];
  /** Custom max height style for the outer container. */
  maxHeight?: string | number;
  /** Trigger value that forces auto-scroll reset and scroll to bottom when changed. Used for user-initiated actions like sending a message. */
  scrollTrigger?: number;
}

/**
 * ScrollFadeContainer wraps a scrollable container with fade gradient overlays.
 * It monitors the scroll position to dynamically show/hide the top and bottom gradients.
 * It also supports pinning the scroll position to the bottom when updates occur.
 */
export function ScrollFadeContainer({
  children,
  className = '',
  contentClassName = '',
  autoScroll = false,
  dependencies = [],
  maxHeight,
  scrollTrigger,
}: ScrollFadeContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(autoScroll);
  const scheduledFrameRef = useRef<number | null>(null);
  const userScrollIntentRef = useRef(false);
  const pointerScrollActiveRef = useRef(false);
  const touchScrollActiveRef = useRef(false);
  const userScrollDirectionRef = useRef<UserScrollDirection>('none');
  /** Tracks the previous scrollTrigger value to detect changes reliably (handles wraparound). */
  const prevScrollTriggerRef = useRef(scrollTrigger);

  /**
   * Evaluates the scroll position and container heights to toggle top/bottom shadow fade overlays.
   * Directly modifies the DOM class list on the wrapper ref to bypass React rendering cycles.
   * This is a performance optimization for smooth scrolling behavior.
   */
  const updateShadows = useCallback(() => {
    const container = scrollRef.current;
    const wrapper = containerRef.current;
    if (!container || !wrapper) return;

    // The container is only scrollable if it has visible height and scrollHeight is strictly greater than clientHeight
    const isScrollable =
      container.clientHeight > 0 && container.scrollHeight > container.clientHeight + 1;
    const showTop = isScrollable && container.scrollTop > 0.5;
    // Add a 1px buffer to account for rounding errors on high-DPI zoom/subpixel values
    const showBottom =
      isScrollable && container.scrollTop + container.clientHeight < container.scrollHeight - 1;

    if (showTop) {
      wrapper.classList.add('has-top-shadow');
    } else {
      wrapper.classList.remove('has-top-shadow');
    }

    if (showBottom) {
      wrapper.classList.add('has-bottom-shadow');
    } else {
      wrapper.classList.remove('has-bottom-shadow');
    }
  }, []);

  const cancelScheduledScroll = useCallback(() => {
    if (scheduledFrameRef.current !== null) {
      cancelAnimationFrame(scheduledFrameRef.current);
      scheduledFrameRef.current = null;
    }
  }, []);

  const scheduleScrollToBottom = useCallback(() => {
    if (!autoScroll || !shouldStickToBottomRef.current) {
      updateShadows();
      return;
    }

    cancelScheduledScroll();

    let framesRemaining = AUTO_SCROLL_SETTLE_FRAMES;
    const run = () => {
      scheduledFrameRef.current = null;
      const container = scrollRef.current;
      if (!container) return;

      if (shouldStickToBottomRef.current) {
        // Large output bursts can change height across multiple layouts; repeating
        // the snap for a few frames keeps the bottom anchor until the DOM settles.
        scrollToBottom(container);
      }
      updateShadows();

      framesRemaining -= 1;
      if (framesRemaining > 0 && shouldStickToBottomRef.current) {
        scheduledFrameRef.current = requestAnimationFrame(run);
      }
    };

    scheduledFrameRef.current = requestAnimationFrame(run);
  }, [autoScroll, cancelScheduledScroll, updateShadows]);

  const isEventFromCurrentScrollContainer = useCallback((target: EventTarget | null): boolean => {
    const container = scrollRef.current;
    if (!container || !(target instanceof Element)) return false;
    return target.closest('.scroll-fade-content') === container;
  }, []);

  const markUserScrollIntent = useCallback((direction: UserScrollDirection) => {
    userScrollIntentRef.current = true;
    userScrollDirectionRef.current = direction;
  }, []);

  const clearDiscreteScrollIntent = useCallback(() => {
    if (pointerScrollActiveRef.current || touchScrollActiveRef.current) return;
    userScrollIntentRef.current = false;
    userScrollDirectionRef.current = 'none';
  }, []);

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!isEventFromCurrentScrollContainer(event.target)) return;
      const direction = event.deltaY < 0 ? 'up' : event.deltaY > 0 ? 'down' : 'unknown';
      markUserScrollIntent(direction);
    },
    [isEventFromCurrentScrollContainer, markUserScrollIntent],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.target !== scrollRef.current || !isEventFromCurrentScrollContainer(event.target)) {
        return;
      }
      pointerScrollActiveRef.current = true;
      markUserScrollIntent('unknown');
    },
    [isEventFromCurrentScrollContainer, markUserScrollIntent],
  );

  const handleTouchStart = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (!isEventFromCurrentScrollContainer(event.target)) return;
      touchScrollActiveRef.current = true;
    },
    [isEventFromCurrentScrollContainer],
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (!isEventFromCurrentScrollContainer(event.target)) return;
      touchScrollActiveRef.current = true;
      markUserScrollIntent('unknown');
    },
    [isEventFromCurrentScrollContainer, markUserScrollIntent],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!isEventFromCurrentScrollContainer(event.target)) return;
      if (event.key === 'ArrowUp' || event.key === 'PageUp' || event.key === 'Home') {
        markUserScrollIntent('up');
      } else if (
        event.key === 'ArrowDown' ||
        event.key === 'PageDown' ||
        event.key === 'End' ||
        event.key === ' '
      ) {
        markUserScrollIntent('down');
      }
    },
    [isEventFromCurrentScrollContainer, markUserScrollIntent],
  );

  /**
   * Scroll event handler.
   * If autoScroll is enabled, updates the bottom lock only after direct user
   * scroll input. Browser/layout scroll events from large content growth should
   * not be allowed to break the sticky-bottom contract.
   */
  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;

    if (autoScroll) {
      const hasUserIntent =
        userScrollIntentRef.current ||
        pointerScrollActiveRef.current ||
        touchScrollActiveRef.current;
      const direction = userScrollDirectionRef.current;

      if (hasUserIntent) {
        if (isAtBottom(container)) {
          shouldStickToBottomRef.current = true;
        } else if (pointerScrollActiveRef.current || touchScrollActiveRef.current) {
          shouldStickToBottomRef.current = false;
        } else if (direction === 'up' || direction === 'unknown') {
          shouldStickToBottomRef.current = false;
        }

        clearDiscreteScrollIntent();
      }
    }
    updateShadows();
  };

  // Force reset auto-scroll and scroll to bottom when scrollTrigger changes
  // This is used for user-initiated actions like sending a message
  useLayoutEffect(() => {
    // Only trigger when scrollTrigger actually changes (handles wraparound to 0)
    if (scrollTrigger === undefined || scrollTrigger === prevScrollTriggerRef.current) return;
    prevScrollTriggerRef.current = scrollTrigger;
    shouldStickToBottomRef.current = true;
    scheduleScrollToBottom();
  }, [scheduleScrollToBottom, scrollTrigger]);

  // Perform auto-scroll to bottom and update shadow states when dependencies or children update
  useLayoutEffect(() => {
    if (autoScroll && shouldStickToBottomRef.current) {
      scheduleScrollToBottom();
    } else {
      updateShadows();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children, autoScroll, scheduleScrollToBottom, updateShadows, ...dependencies]);

  // Set up ResizeObserver to update shadow overlay visibility when container or content size changes
  useEffect(() => {
    const container = scrollRef.current;
    const content = contentRef.current;
    if (!container || !content || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      if (autoScroll && shouldStickToBottomRef.current) {
        scheduleScrollToBottom();
      } else {
        updateShadows();
      }
    });
    observer.observe(container);
    observer.observe(content);

    return () => {
      observer.disconnect();
    };
  }, [autoScroll, scheduleScrollToBottom, updateShadows]);

  useEffect(() => {
    const clearPointerScroll = () => {
      pointerScrollActiveRef.current = false;
      clearDiscreteScrollIntent();
    };
    const clearTouchScroll = () => {
      touchScrollActiveRef.current = false;
      clearDiscreteScrollIntent();
    };

    window.addEventListener('pointerup', clearPointerScroll);
    window.addEventListener('pointercancel', clearPointerScroll);
    window.addEventListener('touchend', clearTouchScroll);
    window.addEventListener('touchcancel', clearTouchScroll);

    return () => {
      window.removeEventListener('pointerup', clearPointerScroll);
      window.removeEventListener('pointercancel', clearPointerScroll);
      window.removeEventListener('touchend', clearTouchScroll);
      window.removeEventListener('touchcancel', clearTouchScroll);
      cancelScheduledScroll();
    };
  }, [cancelScheduledScroll, clearDiscreteScrollIntent]);

  return (
    <div
      className={`scroll-fade-container ${className}`}
      ref={containerRef}
      style={maxHeight !== undefined ? { maxHeight } : undefined}
    >
      <div className="scroll-fade-layer scroll-fade-top" />
      <div
        className={`scroll-fade-content ${contentClassName}`}
        ref={scrollRef}
        onScroll={handleScroll}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onKeyDown={handleKeyDown}
      >
        <div ref={contentRef} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {children}
        </div>
      </div>
      <div className="scroll-fade-layer scroll-fade-bottom" />
    </div>
  );
}
