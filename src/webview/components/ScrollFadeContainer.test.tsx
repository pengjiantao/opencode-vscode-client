/**
 * @file Unit tests for ScrollFadeContainer.
 */

import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScrollFadeContainer } from './ScrollFadeContainer';

interface QueuedAnimationFrames {
  /** Runs every pending animation frame that has not been cancelled. */
  flushAll: () => void;
}

function installQueuedAnimationFrames(): QueuedAnimationFrames {
  let nextFrameID = 1;
  const frames: Array<{ id: number; callback: FrameRequestCallback; cancelled: boolean }> = [];

  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextFrameID++;
    frames.push({ id, callback, cancelled: false });
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    const frame = frames.find((item) => item.id === id);
    if (frame) {
      frame.cancelled = true;
    }
  });

  return {
    flushAll: () => {
      while (frames.length > 0) {
        const frame = frames.shift();
        if (frame && !frame.cancelled) {
          frame.callback(performance.now());
        }
      }
    },
  };
}

describe('ScrollFadeContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => cb(performance.now()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders children correctly', () => {
    const { container, getByText } = render(
      <ScrollFadeContainer>
        <div>Test Child Content</div>
      </ScrollFadeContainer>,
    );

    expect(getByText('Test Child Content')).toBeInTheDocument();
    expect(container.querySelector('.scroll-fade-container')).toBeInTheDocument();
    expect(container.querySelector('.scroll-fade-content')).toBeInTheDocument();
    expect(container.querySelector('.scroll-fade-top')).toBeInTheDocument();
    expect(container.querySelector('.scroll-fade-bottom')).toBeInTheDocument();
  });

  it('applies custom class names and style values', () => {
    const { container } = render(
      <ScrollFadeContainer className="custom-outer" contentClassName="custom-inner" maxHeight={400}>
        <div>Content</div>
      </ScrollFadeContainer>,
    );

    const outer = container.querySelector('.scroll-fade-container');
    const inner = container.querySelector('.scroll-fade-content');

    expect(outer).toHaveClass('custom-outer');
    expect(inner).toHaveClass('custom-inner');
    expect(outer).toHaveStyle('max-height: 400px');
  });

  it('updates shadow classes on scroll', () => {
    const { container } = render(
      <ScrollFadeContainer autoScroll={true}>
        <div>Content</div>
      </ScrollFadeContainer>,
    );

    const outer = container.querySelector('.scroll-fade-container') as HTMLDivElement;
    const inner = container.querySelector('.scroll-fade-content') as HTMLDivElement;

    // Mock scroll height/client height properties
    Object.defineProperty(inner, 'scrollHeight', { configurable: true, value: 500 });
    Object.defineProperty(inner, 'clientHeight', { configurable: true, value: 200 });
    Object.defineProperty(inner, 'scrollTop', { configurable: true, writable: true, value: 0 });

    // Initial state: scrollTop is 0, so top shadow is hidden, bottom shadow should be visible
    act(() => {
      inner.scrollTop = 0;
      inner.dispatchEvent(new Event('scroll'));
    });

    expect(outer).not.toHaveClass('has-top-shadow');
    expect(outer).toHaveClass('has-bottom-shadow');

    // Scroll to middle: both shadows should be visible
    act(() => {
      inner.scrollTop = 100;
      inner.dispatchEvent(new Event('scroll'));
    });

    expect(outer).toHaveClass('has-top-shadow');
    expect(outer).toHaveClass('has-bottom-shadow');

    // Scroll to bottom: top shadow should be visible, bottom shadow should be hidden
    act(() => {
      inner.scrollTop = 300;
      inner.dispatchEvent(new Event('scroll'));
    });

    expect(outer).toHaveClass('has-top-shadow');
    expect(outer).not.toHaveClass('has-bottom-shadow');
  });

  it('should not display shadow effects when there is no scrollable content', () => {
    const { container } = render(
      <ScrollFadeContainer>
        <div>Short Content</div>
      </ScrollFadeContainer>,
    );

    const outer = container.querySelector('.scroll-fade-container') as HTMLDivElement;
    const inner = container.querySelector('.scroll-fade-content') as HTMLDivElement;

    // Mock scroll height/client height properties to be equal
    Object.defineProperty(inner, 'scrollHeight', { configurable: true, value: 150 });
    Object.defineProperty(inner, 'clientHeight', { configurable: true, value: 150 });
    Object.defineProperty(inner, 'scrollTop', { configurable: true, writable: true, value: 0 });

    act(() => {
      inner.dispatchEvent(new Event('scroll'));
    });

    expect(outer).not.toHaveClass('has-top-shadow');
    expect(outer).not.toHaveClass('has-bottom-shadow');
  });

  it('should apply flex layout to inner content wrapper so children can vertically center', () => {
    const { container } = render(
      <ScrollFadeContainer>
        <div data-testid="child">Child</div>
      </ScrollFadeContainer>,
    );

    const inner = container.querySelector('.scroll-fade-content') as HTMLDivElement;
    // The wrapper div around children (next sibling of scroll-fade-content's first child = the wrapper)
    const wrapper = inner.firstElementChild as HTMLDivElement;

    expect(wrapper).toHaveStyle({
      display: 'flex',
      'flex-direction': 'column',
      flex: '1 1 0%',
    });
  });

  it('should not display shadow effects when clientHeight is 0 (hidden or not fully laid out)', () => {
    const { container } = render(
      <ScrollFadeContainer>
        <div>Content</div>
      </ScrollFadeContainer>,
    );

    const outer = container.querySelector('.scroll-fade-container') as HTMLDivElement;
    const inner = container.querySelector('.scroll-fade-content') as HTMLDivElement;

    // Mock clientHeight to be 0 but scrollHeight to be non-zero (typical when hidden)
    Object.defineProperty(inner, 'scrollHeight', { configurable: true, value: 150 });
    Object.defineProperty(inner, 'clientHeight', { configurable: true, value: 0 });
    Object.defineProperty(inner, 'scrollTop', { configurable: true, writable: true, value: 0 });

    act(() => {
      inner.dispatchEvent(new Event('scroll'));
    });

    expect(outer).not.toHaveClass('has-top-shadow');
    expect(outer).not.toHaveClass('has-bottom-shadow');
  });

  it('regression: keeps bottom pin when a large content burst fires scroll before the next frame', () => {
    const frames = installQueuedAnimationFrames();
    const { container, rerender } = render(
      <ScrollFadeContainer autoScroll={true} dependencies={[0]}>
        <div>Initial output</div>
      </ScrollFadeContainer>,
    );

    const inner = container.querySelector('.scroll-fade-content') as HTMLDivElement;
    let scrollHeight = 1000;
    let scrollTop = 800;
    const clientHeight = 200;

    Object.defineProperty(inner, 'scrollHeight', {
      configurable: true,
      get: () => scrollHeight,
    });
    Object.defineProperty(inner, 'clientHeight', {
      configurable: true,
      get: () => clientHeight,
    });
    Object.defineProperty(inner, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });

    act(() => {
      inner.dispatchEvent(new Event('scroll'));
    });

    scrollHeight = 2400;
    act(() => {
      rerender(
        <ScrollFadeContainer autoScroll={true} dependencies={[1]}>
          <div>Initial output</div>
          <div>Large server output burst</div>
        </ScrollFadeContainer>,
      );
    });

    // Browser layout/scroll anchoring can emit scroll before the scheduled
    // bottom snap runs. That must not be treated as a user decision to unpin.
    act(() => {
      inner.dispatchEvent(new Event('scroll'));
    });
    act(() => {
      frames.flushAll();
    });

    expect(scrollTop).toBe(2400);
  });

  describe('scrollTrigger', () => {
    it('should force scroll to bottom when scrollTrigger changes', () => {
      const { container, rerender } = render(
        <ScrollFadeContainer autoScroll={true} scrollTrigger={0}>
          <div>Content</div>
        </ScrollFadeContainer>,
      );

      const inner = container.querySelector('.scroll-fade-content') as HTMLDivElement;

      // Mock scroll height/client height properties
      Object.defineProperty(inner, 'scrollHeight', { configurable: true, value: 500 });
      Object.defineProperty(inner, 'clientHeight', { configurable: true, value: 200 });
      Object.defineProperty(inner, 'scrollTop', { configurable: true, writable: true, value: 0 });

      // Simulate user scrolling up (not at bottom)
      act(() => {
        inner.scrollTop = 100;
        inner.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true }));
        inner.dispatchEvent(new Event('scroll'));
      });

      // Verify scroll is not at bottom
      expect(inner.scrollTop).toBe(100);

      // Change scrollTrigger to force scroll to bottom
      act(() => {
        rerender(
          <ScrollFadeContainer autoScroll={true} scrollTrigger={1}>
            <div>Content</div>
          </ScrollFadeContainer>,
        );
      });

      // Verify scroll position is now at bottom
      expect(inner.scrollTop).toBe(500);
    });

    it('should re-enable auto-scroll when scrollTrigger changes', () => {
      const { container, rerender } = render(
        <ScrollFadeContainer autoScroll={true} scrollTrigger={0}>
          <div>Content</div>
        </ScrollFadeContainer>,
      );

      const inner = container.querySelector('.scroll-fade-content') as HTMLDivElement;

      // Mock scroll height/client height properties
      Object.defineProperty(inner, 'scrollHeight', { configurable: true, value: 500 });
      Object.defineProperty(inner, 'clientHeight', { configurable: true, value: 200 });
      Object.defineProperty(inner, 'scrollTop', { configurable: true, writable: true, value: 0 });

      // Simulate user scrolling up (not at bottom)
      act(() => {
        inner.scrollTop = 100;
        inner.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true }));
        inner.dispatchEvent(new Event('scroll'));
      });

      // Change scrollTrigger to force scroll to bottom
      act(() => {
        rerender(
          <ScrollFadeContainer autoScroll={true} scrollTrigger={1}>
            <div>Content</div>
          </ScrollFadeContainer>,
        );
      });

      // Simulate new content arriving
      act(() => {
        rerender(
          <ScrollFadeContainer autoScroll={true} scrollTrigger={1}>
            <div>Content</div>
            <div>New Content</div>
          </ScrollFadeContainer>,
        );
      });

      // Verify auto-scroll is re-enabled (scrollTop should be at bottom)
      expect(inner.scrollTop).toBe(500);
    });

    it('should not affect behavior when scrollTrigger is undefined', () => {
      const { container, rerender } = render(
        <ScrollFadeContainer autoScroll={true}>
          <div>Content</div>
        </ScrollFadeContainer>,
      );

      const inner = container.querySelector('.scroll-fade-content') as HTMLDivElement;

      // Mock scroll height/client height properties
      Object.defineProperty(inner, 'scrollHeight', { configurable: true, value: 500 });
      Object.defineProperty(inner, 'clientHeight', { configurable: true, value: 200 });
      Object.defineProperty(inner, 'scrollTop', { configurable: true, writable: true, value: 0 });

      // Simulate user scrolling up
      act(() => {
        inner.scrollTop = 100;
        inner.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true }));
        inner.dispatchEvent(new Event('scroll'));
      });

      // Re-render without scrollTrigger
      act(() => {
        rerender(
          <ScrollFadeContainer autoScroll={true}>
            <div>Content</div>
          </ScrollFadeContainer>,
        );
      });

      // Verify scroll position is unchanged (auto-scroll remains disabled)
      expect(inner.scrollTop).toBe(100);
    });
  });

  describe('nested instance isolation', () => {
    it('regression: inner wrapper shadow class is based on inner scroll state, not outer', () => {
      // Regression: nested ScrollFadeContainer instances (e.g. DiffPart / BashOutput
      // inside ChatView) must compute their own shadow classes from their own
      // scroll position. Previously the CSS descendant selector leaked the
      // outer's shadow state into the inner; the JS-side isolation is verified here.
      const { container } = render(
        <ScrollFadeContainer autoScroll={true}>
          <ScrollFadeContainer>
            <div>Tall inner content</div>
          </ScrollFadeContainer>
        </ScrollFadeContainer>,
      );

      const innerWrapper = container.querySelector(
        '.scroll-fade-container .scroll-fade-container',
      ) as HTMLDivElement;
      const innerScroll = innerWrapper.querySelector('.scroll-fade-content') as HTMLDivElement;
      const outerScroll = container.querySelector('.scroll-fade-content') as HTMLDivElement;
      const outerWrapper = outerScroll.parentElement as HTMLDivElement;

      // Both containers are independently scrollable
      Object.defineProperty(outerScroll, 'scrollHeight', { configurable: true, value: 1000 });
      Object.defineProperty(outerScroll, 'clientHeight', { configurable: true, value: 200 });
      Object.defineProperty(outerScroll, 'scrollTop', {
        configurable: true,
        writable: true,
        value: 0,
      });
      Object.defineProperty(innerScroll, 'scrollHeight', { configurable: true, value: 1000 });
      Object.defineProperty(innerScroll, 'clientHeight', { configurable: true, value: 200 });
      Object.defineProperty(innerScroll, 'scrollTop', {
        configurable: true,
        writable: true,
        value: 0,
      });

      // Prime both wrappers by dispatching a scroll event on each so the
      // mocked dimensions are observed by their own updateShadows handlers.
      act(() => {
        outerScroll.dispatchEvent(new Event('scroll'));
        innerScroll.dispatchEvent(new Event('scroll'));
      });

      // Sanity: both wrappers are at the top, so both have bottom-shadow only.
      expect(outerWrapper).not.toHaveClass('has-top-shadow');
      expect(outerWrapper).toHaveClass('has-bottom-shadow');
      expect(innerWrapper).not.toHaveClass('has-top-shadow');
      expect(innerWrapper).toHaveClass('has-bottom-shadow');

      // Scroll the outer to the bottom — outer wrapper should get has-top-shadow.
      act(() => {
        outerScroll.scrollTop = 800;
        outerScroll.dispatchEvent(new Event('scroll'));
      });

      expect(outerWrapper).toHaveClass('has-top-shadow');
      expect(outerWrapper).not.toHaveClass('has-bottom-shadow');

      // Inner scroll state is unchanged (still at scrollTop=0) — its wrapper
      // must still be in the "at top" configuration. This catches the
      // per-instance class isolation requirement: the inner must not pick up
      // has-top-shadow just because the outer was scrolled.
      expect(innerWrapper).not.toHaveClass('has-top-shadow');
      expect(innerWrapper).toHaveClass('has-bottom-shadow');

      // Scroll the outer back to the top — outer wrapper should get has-bottom-shadow.
      act(() => {
        outerScroll.scrollTop = 0;
        outerScroll.dispatchEvent(new Event('scroll'));
      });

      expect(outerWrapper).not.toHaveClass('has-top-shadow');
      expect(outerWrapper).toHaveClass('has-bottom-shadow');

      // Inner state is unchanged — still at top, so still has-bottom-shadow only.
      expect(innerWrapper).not.toHaveClass('has-top-shadow');
      expect(innerWrapper).toHaveClass('has-bottom-shadow');
    });

    it('regression: CSS shadow visibility must not leak from outer to inner via descendant selector', () => {
      // Regression for the descendant-selector leak that caused inner
      // ScrollFadeContainer instances (e.g. DiffPart inside ChatView) to
      // show top/bottom shadows whenever the outer (chat) wrapper had the
      // matching class. The fix uses the direct-child combinator (>) in CSS;
      // this test asserts the resulting selector behaviour via Element.matches.
      const { container } = render(
        <ScrollFadeContainer className="outer-instance">
          <ScrollFadeContainer className="inner-instance">
            <div>Inner</div>
          </ScrollFadeContainer>
        </ScrollFadeContainer>,
      );

      const innerWrapper = container.querySelector('.inner-instance') as HTMLDivElement;
      const innerTop = innerWrapper.querySelector('.scroll-fade-top') as HTMLDivElement;
      const innerBottom = innerWrapper.querySelector('.scroll-fade-bottom') as HTMLDivElement;
      const outerWrapper = container.querySelector('.outer-instance') as HTMLDivElement;

      // Simulate the outer being scrolled away from the top.
      outerWrapper.classList.add('has-top-shadow');
      // Simulate the inner still being at the top (its shadow is OFF).
      expect(innerWrapper).not.toHaveClass('has-top-shadow');

      // The descendant selector (old behaviour) WOULD match the inner's
      // .scroll-fade-top because it is a descendant of the outer wrapper.
      // The fixed direct-child selector MUST NOT match — the inner's
      // .scroll-fade-top is nested deeper, not a direct child of the outer.
      const leakedDescendantMatch = innerTop.matches(
        '.scroll-fade-container.has-top-shadow .scroll-fade-top',
      );
      const scopedDirectChildMatch = innerTop.matches(
        '.scroll-fade-container.has-top-shadow > .scroll-fade-top',
      );

      expect(leakedDescendantMatch).toBe(true);
      expect(scopedDirectChildMatch).toBe(false);

      // Repeat for the bottom-shadow side.
      outerWrapper.classList.remove('has-top-shadow');
      outerWrapper.classList.add('has-bottom-shadow');
      expect(innerWrapper).not.toHaveClass('has-bottom-shadow');

      const leakedBottomMatch = innerBottom.matches(
        '.scroll-fade-container.has-bottom-shadow .scroll-fade-bottom',
      );
      const scopedBottomMatch = innerBottom.matches(
        '.scroll-fade-container.has-bottom-shadow > .scroll-fade-bottom',
      );

      expect(leakedBottomMatch).toBe(true);
      expect(scopedBottomMatch).toBe(false);
    });
  });
});
