/**
 * @file Reusable scrolling container with optional auto-scroll and top/bottom gradient shadows (fading effects).
 */

import React, { useEffect, useRef, useState } from 'react';

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
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(autoScroll);
  /** Tracks the previous scrollTrigger value to detect changes reliably (handles wraparound). */
  const prevScrollTriggerRef = useRef(scrollTrigger);
  /** Flag to force scroll to bottom on next effect cycle (set by scrollTrigger changes). */
  const forceScrollRef = useRef(false);

  /**
   * Evaluates the scroll position and container heights to toggle top/bottom shadow fade overlays.
   * Directly modifies the DOM class list on the wrapper ref to bypass React rendering cycles.
   * This is a performance optimization for smooth scrolling behavior.
   */
  const updateShadows = () => {
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
  };

  /**
   * Scroll event handler.
   * If autoScroll is enabled, updates the autoScroll lock state based on whether
   * the user is at the bottom of the container.
   */
  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;

    if (autoScroll) {
      // 10px threshold to account for fractional pixels and subpixel rendering
      const threshold = 10;
      const isAtBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
      setIsAutoScrollEnabled(isAtBottom);
    }
    updateShadows();
  };

  // Force reset auto-scroll and scroll to bottom when scrollTrigger changes
  // This is used for user-initiated actions like sending a message
  useEffect(() => {
    // Only trigger when scrollTrigger actually changes (handles wraparound to 0)
    if (scrollTrigger === undefined || scrollTrigger === prevScrollTriggerRef.current) return;
    prevScrollTriggerRef.current = scrollTrigger;
    // Set flag to force scroll on next effect cycle (avoids setState in effect)
    forceScrollRef.current = true;
    // Trigger re-render by updating state (this is acceptable as it's a direct user action)
    setIsAutoScrollEnabled(true);
    return () => {
      forceScrollRef.current = false;
    };
  }, [scrollTrigger]);

  // Perform auto-scroll to bottom and update shadow states when dependencies or children update
  useEffect(() => {
    const runUpdate = () => {
      if (scrollRef.current) {
        // Check if forced scroll was requested (from scrollTrigger change)
        if (forceScrollRef.current) {
          forceScrollRef.current = false;
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        } else if (autoScroll && isAutoScrollEnabled) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
        updateShadows();
      }
    };
    const animationFrameId = requestAnimationFrame(runUpdate);
    return () => cancelAnimationFrame(animationFrameId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children, autoScroll, isAutoScrollEnabled, ...dependencies]);

  // Set up ResizeObserver to update shadow overlay visibility when container or content size changes
  useEffect(() => {
    const container = scrollRef.current;
    const content = contentRef.current;
    if (!container || !content || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      updateShadows();
    });
    observer.observe(container);
    observer.observe(content);

    return () => {
      observer.disconnect();
    };
  }, []);

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
      >
        <div ref={contentRef} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {children}
        </div>
      </div>
      <div className="scroll-fade-layer scroll-fade-bottom" />
    </div>
  );
}
