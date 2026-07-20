/**
 * @file Unit and regression tests for the custom Tooltip component.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerTooltipContent } from '../utils/tooltipContentRegistry';
import { CodeBlock } from './CodeBlock';
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

  it('renders registered React content without injecting an HTML string', () => {
    const contentId = registerTooltipContent(
      <strong data-testid="rich-content">Rich content</strong>,
    );
    render(
      <div>
        <Tooltip />
        <button data-testid="btn" data-custom-title-content={contentId}>
          Hover Me
        </button>
      </div>,
    );

    fireEvent.mouseOver(screen.getByTestId('btn'));
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByTestId('rich-content')).toHaveTextContent('Rich content');
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

    // Still visible before 150ms hide delay
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByTestId('custom-tooltip')).toBeInTheDocument();

    // Past 150ms - tooltip should be hidden
    act(() => {
      vi.advanceTimersByTime(50);
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

  it('regression: preserves rich tooltip content when hovering a nested copy button', () => {
    const contentId = registerTooltipContent(
      <CodeBlock lang="typescript" code="const value = 1;" />,
    );
    render(
      <div>
        <Tooltip />
        <button data-testid="trigger" data-custom-title-content={contentId}>
          Hover Me
        </button>
      </div>,
    );

    fireEvent.mouseOver(screen.getByTestId('trigger'));
    act(() => {
      vi.advanceTimersByTime(400);
    });

    const tooltip = screen.getByTestId('custom-tooltip');
    const copyButton = screen.getByRole('button', { name: 'Copy Code' });
    fireEvent.mouseOver(copyButton);
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(tooltip).toContainElement(copyButton);
    expect(tooltip).toHaveTextContent('const value = 1;');
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

  it('should dynamically update the tooltip text if data-custom-title changes while hovered', () => {
    const { rerender } = render(
      <div>
        <Tooltip />
        <button data-testid="btn" data-custom-title="Initial Title">
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
    const tooltip = screen.getByTestId('custom-tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip.textContent).toBe('Initial Title');

    // Dynamically change data-custom-title (re-render)
    rerender(
      <div>
        <Tooltip />
        <button data-testid="btn" data-custom-title="Updated Title">
          Button
        </button>
      </div>,
    );

    // Trigger another mouseover on the same button to notify tooltip
    const updatedBtn = screen.getByTestId('btn');
    fireEvent.mouseOver(updatedBtn);

    // The text should update instantly in the tooltip without waiting for a timer
    expect(screen.getByTestId('custom-tooltip').textContent).toBe('Updated Title');
  });

  it('should switch between tooltips immediately when one is already visible', () => {
    render(
      <div>
        <Tooltip />
        <button data-testid="btn-a" data-custom-title="Title A">
          Button A
        </button>
        <button data-testid="btn-b" data-custom-title="Title B">
          Button B
        </button>
      </div>,
    );

    const btnA = screen.getByTestId('btn-a');
    const btnB = screen.getByTestId('btn-b');

    // Hover over A and show tooltip
    fireEvent.mouseOver(btnA);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByTestId('custom-tooltip').textContent).toBe('Title A');

    // Move to B immediately (mouseout of A, mouseover of B)
    fireEvent.mouseOut(btnA);
    fireEvent.mouseOver(btnB);

    // The tooltip should instantly update to B's title (no 400ms delay required!)
    const tooltip = screen.getByTestId('custom-tooltip');
    expect(tooltip.textContent).toBe('Title B');

    // And moving off B should start the hide delay
    fireEvent.mouseOut(btnB);

    // Still visible before 150ms hide delay
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByTestId('custom-tooltip')).toBeInTheDocument();

    // Gone after 150ms
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.queryByTestId('custom-tooltip')).toBeNull();
  });

  it('should robustly hide the tooltip on mouseOut even if the target button children are unmounted/replaced on click', () => {
    const { rerender } = render(
      <div>
        <Tooltip />
        <button data-testid="btn" data-custom-title="Copy Text">
          <span data-testid="child-icon">Icon</span>
        </button>
      </div>,
    );

    const child = screen.getByTestId('child-icon');

    // 1. Hover over the child icon inside the button and show the tooltip
    fireEvent.mouseOver(child);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByTestId('custom-tooltip').textContent).toBe('Copy Text');

    // 2. Click is handled, dynamically changing children (the old span is unmounted/replaced)
    rerender(
      <div>
        <Tooltip />
        <button data-testid="btn" data-custom-title="Copied!">
          <span data-testid="new-child-icon">Checkmark</span>
        </button>
      </div>,
    );

    // Notify of mouseOver change for dynamic text
    const updatedBtn = screen.getByTestId('btn');
    fireEvent.mouseOver(updatedBtn);
    expect(screen.getByTestId('custom-tooltip').textContent).toBe('Copied!');

    // 3. Move mouse out to a blank area (the mouseout fires, relatedTarget is document.body or null)
    fireEvent.mouseOut(updatedBtn, { relatedTarget: document.body });

    // 4. Advance time past the 250ms hide delay threshold. The tooltip should close!
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.queryByTestId('custom-tooltip')).toBeNull();
  });

  it('should instantly reposition the tooltip when switching between different targets sharing the same custom title text', () => {
    render(
      <div>
        <Tooltip />
        <button data-testid="btn-a" data-custom-title="Same Title">
          Button A
        </button>
        <button data-testid="btn-b" data-custom-title="Same Title">
          Button B
        </button>
      </div>,
    );

    const btnA = screen.getByTestId('btn-a');
    const btnB = screen.getByTestId('btn-b');

    // Mock different bounding rects for btnA and btnB
    btnA.getBoundingClientRect = () =>
      ({
        left: 100,
        top: 100,
        width: 50,
        height: 20,
      }) as DOMRect;

    btnB.getBoundingClientRect = () =>
      ({
        left: 200,
        top: 200,
        width: 50,
        height: 20,
      }) as DOMRect;

    // Hover over A and show tooltip
    fireEvent.mouseOver(btnA);
    act(() => {
      vi.advanceTimersByTime(400);
    });

    const tooltip = screen.getByTestId('custom-tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip.textContent).toBe('Same Title');

    // Mock tooltip size
    tooltip.getBoundingClientRect = () =>
      ({
        width: 60,
        height: 30,
      }) as DOMRect;

    // Trigger initial positioning update
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    // Check position is above A (x center: 100 + (50 - 60)/2 = 95, top: 100 - 30 - 8 = 62)
    expect(tooltip.style.left).toBe('95px');
    expect(tooltip.style.top).toBe('62px');

    // Move directly from A to B
    fireEvent.mouseOut(btnA, { relatedTarget: btnB });
    fireEvent.mouseOver(btnB);

    // The tooltip should instantly update position to B (x center: 200 + (50 - 60)/2 = 195, top: 200 - 30 - 8 = 162)
    // because activeTarget state change triggers re-positioning layout effect
    expect(tooltip.style.left).toBe('195px');
    expect(tooltip.style.top).toBe('162px');
  });

  it('should measure unconstrained height offscreen when switching targets directly', () => {
    render(
      <div>
        <Tooltip />
        <button data-testid="btn-a" data-custom-title="Tall Content">
          Button A
        </button>
        <button data-testid="btn-b" data-custom-title="Short Content">
          Button B
        </button>
      </div>,
    );

    const btnA = screen.getByTestId('btn-a');
    const btnB = screen.getByTestId('btn-b');

    // Position Button A at top: 200px
    btnA.getBoundingClientRect = () =>
      ({
        left: 100,
        top: 200,
        width: 50,
        height: 20,
      }) as DOMRect;

    // Position Button B at top: 300px
    btnB.getBoundingClientRect = () =>
      ({
        left: 100,
        top: 300,
        width: 50,
        height: 20,
      }) as DOMRect;

    // Hover over A and show tooltip
    fireEvent.mouseOver(btnA);
    act(() => {
      vi.advanceTimersByTime(400);
    });

    const tooltip = screen.getByTestId('custom-tooltip');
    expect(tooltip).toBeInTheDocument();

    // Mock tooltip getBoundingClientRect
    // If it is positioned offscreen (left/top is -9999px), return the true unconstrained height (30px).
    // Otherwise, if it is at the old constrained position (which simulates screen collision/restriction), return 100px.
    tooltip.getBoundingClientRect = function (this: HTMLElement) {
      if (this.style.left === '-9999px' && this.style.top === '-9999px') {
        return {
          width: 60,
          height: 30,
        } as DOMRect;
      }
      return {
        width: 60,
        height: 100, // Constrained height
      } as DOMRect;
    };

    // Move directly from A to B
    fireEvent.mouseOut(btnA, { relatedTarget: btnB });
    fireEvent.mouseOver(btnB);

    // If the fix works, it will temporarily position the tooltip offscreen,
    // measure the height as 30px, and place it at top: 300 (btnB.top) - 30 (height) - 8 = 262px.
    // If the fix did NOT work, it would measure it as 100px (the constrained height),
    // and place it at top: 300 - 100 - 8 = 192px.
    expect(tooltip.style.top).toBe('262px');
  });

  it('should position the tooltip to the right of the popover container when there is space', () => {
    // Mock viewport boundaries
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1000 });
    Object.defineProperty(window, 'innerHeight', { writable: true, value: 800 });

    const { unmount } = render(
      <div>
        <Tooltip />
        <div
          className="popover-content"
          data-testid="popover"
          style={{
            position: 'absolute',
            left: '100px',
            top: '100px',
            width: '200px',
            height: '300px',
          }}
        >
          <button data-testid="option" data-custom-title="Popover Option Content">
            Option
          </button>
        </div>
      </div>,
    );

    const popover = screen.getByTestId('popover');
    const option = screen.getByTestId('option');

    // Mock popover position (left: 100, top: 100, width: 200, height: 300, right: 300, bottom: 400)
    popover.getBoundingClientRect = () =>
      ({
        left: 100,
        top: 100,
        width: 200,
        height: 300,
        right: 300,
        bottom: 400,
      }) as DOMRect;

    // Mock option position (left: 110, top: 120, width: 180, height: 30, right: 290, bottom: 150)
    option.getBoundingClientRect = () =>
      ({
        left: 110,
        top: 120,
        width: 180,
        height: 30,
        right: 290,
        bottom: 150,
      }) as DOMRect;

    // Show tooltip
    fireEvent.mouseOver(option);
    act(() => {
      vi.advanceTimersByTime(400);
    });

    const tooltip = screen.getByTestId('custom-tooltip');
    expect(tooltip).toBeInTheDocument();

    // Mock tooltip size
    tooltip.getBoundingClientRect = () =>
      ({
        width: 150,
        height: 40,
      }) as DOMRect;

    // Trigger positioning update
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    // Check position:
    // Placement should be 'right' since viewport is 1000, popover.right is 300, space on right is 1000 - 300 = 700 (enough for tooltip width 150 + 8)
    // Horizontal: popoverRect.right (300) + 8 = 308px
    // Vertical: option.top (120) + (option.height (30) - tooltip.height (40)) / 2 = 120 - 5 = 115px
    expect(tooltip.style.left).toBe('308px');
    expect(tooltip.style.top).toBe('115px');

    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth });
    Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight });
    unmount();
  });

  it('should position the tooltip to the left of the popover container when right space is restricted', () => {
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 });
    Object.defineProperty(window, 'innerHeight', { writable: true, value: 800 });

    const { unmount } = render(
      <div>
        <Tooltip />
        <div
          className="popover-content"
          data-testid="popover"
          style={{
            position: 'absolute',
            left: '300px',
            top: '100px',
            width: '180px',
            height: '300px',
          }}
        >
          <button data-testid="option" data-custom-title="Popover Option Content">
            Option
          </button>
        </div>
      </div>,
    );

    const popover = screen.getByTestId('popover');
    const option = screen.getByTestId('option');

    popover.getBoundingClientRect = () =>
      ({
        left: 300,
        top: 100,
        width: 180,
        height: 300,
        right: 480,
        bottom: 400,
      }) as DOMRect;

    option.getBoundingClientRect = () =>
      ({
        left: 310,
        top: 120,
        width: 160,
        height: 30,
        right: 470,
        bottom: 150,
      }) as DOMRect;

    fireEvent.mouseOver(option);
    act(() => {
      vi.advanceTimersByTime(400);
    });

    const tooltip = screen.getByTestId('custom-tooltip');
    expect(tooltip).toBeInTheDocument();

    tooltip.getBoundingClientRect = () =>
      ({
        width: 150,
        height: 40,
      }) as DOMRect;

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    // Check position:
    // Viewport width = 500, popover.right = 480. Space right = 500 - 480 - 150 - 8 = -138 (insufficient)
    // popover.left = 300. Space left = 300 - 150 - 8 = 142 (enough)
    // Placement choice: 'left'
    // Horizontal: popoverRect.left (300) - tooltipRect.width (150) - 8 = 142px
    // Vertical: option.top (120) + (option.height (30) - tooltip.height (40)) / 2 = 115px
    expect(tooltip.style.left).toBe('142px');
    expect(tooltip.style.top).toBe('115px');

    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth });
    Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight });
    unmount();
  });
});
