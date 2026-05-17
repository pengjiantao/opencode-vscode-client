/**
 * @file Unit and regression tests for the custom Tooltip component.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Tooltip } from './Tooltip';

describe('Tooltip Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock getBoundingClientRect globally for tests to prevent auto-hiding
    vi.spyOn(window.HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      return {
        width: 100,
        height: 30,
        top: 100,
        left: 100,
        bottom: 130,
        right: 200,
        x: 100,
        y: 100,
        toJSON: () => {},
      };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should not render anything initially', () => {
    render(<Tooltip />);
    const tooltip = screen.queryByTestId('custom-tooltip');
    expect(tooltip).toBeNull();
  });

  it('should show the tooltip after the 400ms delay when hovering', () => {
    render(
      <div>
        <Tooltip />
        <button data-testid="btn" data-custom-title="Test Tooltip Content">
          Hover Me
        </button>
      </div>,
    );

    const btn = screen.getByTestId('btn');

    // Hover mouse over the button (trigger mouseover)
    fireEvent.mouseOver(btn);

    // Should not render immediately
    expect(screen.queryByTestId('custom-tooltip')).toBeNull();

    // Advance time by 300ms (not yet 400ms)
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByTestId('custom-tooltip')).toBeNull();

    // Advance remaining 100ms
    act(() => {
      vi.advanceTimersByTime(100);
    });

    const tooltip = screen.getByTestId('custom-tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip.textContent).toBe('Test Tooltip Content');
  });

  it('should not show if mouse leaves before the 400ms delay threshold', () => {
    render(
      <div>
        <Tooltip />
        <button data-testid="btn" data-custom-title="Test Tooltip Content">
          Hover Me
        </button>
      </div>,
    );

    const btn = screen.getByTestId('btn');

    // Enter
    fireEvent.mouseOver(btn);
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Leave early
    fireEvent.mouseOut(btn);

    // Advance remaining 300ms
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.queryByTestId('custom-tooltip')).toBeNull();
  });

  it('should hide the tooltip after a 250ms delay when leaving the target', () => {
    render(
      <div>
        <Tooltip />
        <button data-testid="btn" data-custom-title="Test Tooltip Content">
          Hover Me
        </button>
      </div>,
    );

    const btn = screen.getByTestId('btn');

    // Trigger hover show
    fireEvent.mouseOver(btn);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByTestId('custom-tooltip')).toBeInTheDocument();

    // Trigger leave
    fireEvent.mouseOut(btn);

    // Still visible before 250ms
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(screen.getByTestId('custom-tooltip')).toBeInTheDocument();

    // Past 250ms
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.queryByTestId('custom-tooltip')).toBeNull();
  });

  it('should support copyable text: keep tooltip open if cursor moves onto the tooltip itself', () => {
    render(
      <div>
        <Tooltip />
        <button data-testid="btn" data-custom-title="Test Tooltip Content">
          Hover Me
        </button>
      </div>,
    );

    const btn = screen.getByTestId('btn');

    // 1. Show tooltip
    fireEvent.mouseOver(btn);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    const tooltip = screen.getByTestId('custom-tooltip');
    expect(tooltip).toBeInTheDocument();

    // 2. Mouse leaves trigger element
    fireEvent.mouseOut(btn);

    // 3. Mouse enters tooltip container within the 250ms delay window
    fireEvent.mouseEnter(tooltip);

    // 4. Advance time past the 250ms threshold. The tooltip should REMAIN visible
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByTestId('custom-tooltip')).toBeInTheDocument();

    // 5. Mouse leaves the tooltip container
    fireEvent.mouseLeave(tooltip);

    // 6. Still there initially
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByTestId('custom-tooltip')).toBeInTheDocument();

    // 7. Gone after the 250ms delay completes
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(screen.queryByTestId('custom-tooltip')).toBeNull();
  });

  it('should dynamically calculate coordinates and adjust placements on bounds collision', () => {
    // Mock viewport boundaries
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 500 });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 500,
    });

    const { unmount } = render(
      <div>
        <Tooltip />
        <button data-testid="btn" data-custom-title="Test Title">
          Hover Me
        </button>
      </div>,
    );

    const btn = screen.getByTestId('btn');

    // Mock target bounds: positioned at top left (x=10, y=5)
    btn.getBoundingClientRect = () =>
      ({
        left: 10,
        top: 5,
        width: 50,
        height: 20,
        right: 60,
        bottom: 25,
      }) as DOMRect;

    // Show tooltip
    fireEvent.mouseOver(btn);
    act(() => {
      vi.advanceTimersByTime(400);
    });

    const tooltip = screen.getByTestId('custom-tooltip');
    expect(tooltip).toBeInTheDocument();

    // Mock tooltip bounds
    tooltip.getBoundingClientRect = () =>
      ({
        width: 120,
        height: 30,
      }) as DOMRect;

    // Trigger updatePosition by advancing timer or rendering
    act(() => {
      // Trigger scroll/resize manually to refresh positions
      window.dispatchEvent(new Event('resize'));
    });

    // Top is 5. Since top < 8, placement should swap to bottom of target: bottom (25) + 8 = 33.
    // Horizontal center would be 10 + (50 - 120)/2 = -25. Bound left margin is 8px.
    expect(tooltip.style.top).toBe('33px');
    expect(tooltip.style.left).toBe('8px');

    // Clean up window size property overrides
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth });
    Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight });
    unmount();
  });

  it('should automatically dismiss the tooltip when the target element is unmounted', () => {
    const { rerender } = render(
      <div>
        <Tooltip />
        <button data-testid="btn" data-custom-title="Test Content">
          Button
        </button>
      </div>,
    );

    const btn = screen.getByTestId('btn');

    // Show tooltip
    fireEvent.mouseOver(btn);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByTestId('custom-tooltip')).toBeInTheDocument();

    // Mock btn removal in re-render
    rerender(
      <div>
        <Tooltip />
      </div>,
    );

    // Advance active monitoring interval (100ms)
    act(() => {
      vi.advanceTimersByTime(150);
    });

    // The tooltip should have been removed instantly
    expect(screen.queryByTestId('custom-tooltip')).toBeNull();
  });
});
