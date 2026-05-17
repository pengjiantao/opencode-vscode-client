/**
 * @file Reusable Popover component with outside-click detection and layout positioning.
 */

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

/** Props for the Popover component. */
export interface PopoverProps {
  /** Trigger element that toggles the popover visibility when clicked. */
  trigger: ReactNode;
  /**
   * Children content to render inside the popover.
   * Can be a ReactNode or a render function that receives a close function.
   */
  children: ReactNode | ((options: { close: () => void }) => ReactNode);
  /** Layout placement relative to the trigger. Defaults to 'bottom'. */
  placement?: 'top' | 'bottom';
  /** Optional container class name. */
  className?: string;
  /** Optional popover wrapper class name. */
  popoverClassName?: string;
}

/**
 * Reusable Popover component that displays contextual overlays.
 * Automatically closes on click-outside and supports flexible placements.
 */
export function Popover({
  trigger,
  children,
  placement = 'bottom',
  className = '',
  popoverClassName = '',
}: PopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close the popover on clicks outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close the popover when the user presses Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <div className={`popover-container ${className}`} ref={containerRef}>
      <div className="popover-trigger-wrapper" onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>
      {isOpen && (
        <div className={`popover-content placement-${placement} ${popoverClassName}`}>
          {typeof children === 'function' ? children({ close: handleClose }) : children}
        </div>
      )}
    </div>
  );
}
