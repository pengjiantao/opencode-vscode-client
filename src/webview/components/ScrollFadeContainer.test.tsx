/**
 * @file Unit tests for ScrollFadeContainer.
 */

import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScrollFadeContainer } from './ScrollFadeContainer';

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
});
