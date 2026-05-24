/**
 * @file Unit tests for the BashOutput component, including auto-scroll and height behavior.
 */

import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BashOutput } from './BashOutput';

describe('BashOutput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => cb(performance.now()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders command and output correctly', () => {
    render(<BashOutput command="ls -la" output="total 0\ndrwxr-xr-x" status="completed" />);

    expect(screen.getByText('ls -la')).toBeInTheDocument();
    expect(screen.getByText(/total 0/)).toBeInTheDocument();
  });

  it('shows spinner icon when status is running', () => {
    const { container } = render(<BashOutput command="ls" output="output" status="running" />);

    expect(container.querySelector('.codicon-sync.codicon-modifier-spin')).toBeInTheDocument();
  });

  it('hides spinner icon when status is completed', () => {
    const { container } = render(<BashOutput command="ls" output="output" status="completed" />);

    expect(container.querySelector('.codicon-sync')).not.toBeInTheDocument();
  });

  it('returns null when output is empty', () => {
    const { container } = render(<BashOutput command="ls" output="" status="running" />);

    expect(container.querySelector('.tool-bash-output')).not.toBeInTheDocument();
  });

  it('regression: auto-scrolls to bottom when new output arrives and user is at bottom', () => {
    const { rerender } = render(
      <BashOutput command="ls" output="initial output" status="running" />,
    );

    // Simulate the scroll element being set
    const scrollContainer = screen.getByText('initial output').parentElement;
    if (scrollContainer) {
      Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1000, configurable: true });
      Object.defineProperty(scrollContainer, 'scrollTop', {
        value: 960,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(scrollContainer, 'clientHeight', { value: 200, configurable: true });

      // Trigger re-render with new output
      act(() => {
        rerender(
          <BashOutput command="ls" output="initial output\nnew output line" status="running" />,
        );
      });

      // Verify scrollTop was actually set to scrollHeight (auto-scroll to bottom)
      expect(scrollContainer.scrollTop).toBe(1000);
    }
  });

  it('regression: does not auto-scroll when user has scrolled up to inspect output', () => {
    const { rerender } = render(
      <BashOutput command="ls" output="initial output" status="running" />,
    );

    const scrollContainer = screen.getByText('initial output').parentElement;
    if (scrollContainer) {
      // User has scrolled up (not at bottom)
      Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1000, configurable: true });
      Object.defineProperty(scrollContainer, 'scrollTop', {
        value: 500,
        configurable: true,
        writable: true,
      }); // Middle of content
      Object.defineProperty(scrollContainer, 'clientHeight', { value: 200, configurable: true });

      // Trigger re-render with new output
      act(() => {
        rerender(
          <BashOutput command="ls" output="initial output\nnew output line" status="running" />,
        );
      });

      // scrollTop should remain at 500 (user's position)
      expect(scrollContainer.scrollTop).toBe(500);
    }
  });
});
