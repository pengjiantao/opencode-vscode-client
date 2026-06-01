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

  it('always displays standard $: prompt prefix regardless of status', () => {
    const { rerender, container } = render(
      <BashOutput command="ls" output="output" status="running" />,
    );
    expect(screen.getByText('$:')).toBeInTheDocument();
    expect(container.querySelector('.codicon')).not.toBeInTheDocument();

    rerender(<BashOutput command="ls" output="output" status="completed" />);
    expect(screen.getByText('$:')).toBeInTheDocument();
    expect(container.querySelector('.codicon')).not.toBeInTheDocument();

    rerender(<BashOutput command="ls" output="output" status="error" />);
    expect(screen.getByText('$:')).toBeInTheDocument();
    expect(container.querySelector('.codicon')).not.toBeInTheDocument();

    rerender(<BashOutput command="ls" output="output" status="pending" />);
    expect(screen.getByText('$:')).toBeInTheDocument();
    expect(container.querySelector('.codicon')).not.toBeInTheDocument();
  });

  it('parses and renders plain output correctly', () => {
    render(<BashOutput command="ls" output="hello world" status="completed" />);
    const textNode = screen.getByText('hello world');
    expect(textNode).toBeInTheDocument();
    expect(textNode.style.color).toBe('');
    expect(textNode.style.fontWeight).toBe('');
  });

  it('parses and renders ANSI foreground colors', () => {
    // String.fromCharCode(27) is the ESC character
    const esc = String.fromCharCode(27);
    render(
      <BashOutput command="ls" output={`hello ${esc}[31mred${esc}[0m text`} status="completed" />,
    );
    const helloNode = screen.getByText(/hello/);
    expect(helloNode).toBeInTheDocument();
    expect(helloNode.textContent).toBe('hello ');

    const redNode = screen.getByText('red');
    expect(redNode).toBeInTheDocument();
    expect(redNode.style.color).toBe('var(--vscode-terminal-ansiRed, #cd3131)');

    const textNode = screen.getByText(/text/);
    expect(textNode).toBeInTheDocument();
    expect(textNode.textContent).toBe(' text');
  });

  it('parses and renders compound ANSI styles (bold + color)', () => {
    const esc = String.fromCharCode(27);
    render(
      <BashOutput command="ls" output={`${esc}[1;32mboldgreen${esc}[0m`} status="completed" />,
    );
    const node = screen.getByText('boldgreen');
    expect(node).toBeInTheDocument();
    expect(node.style.fontWeight).toBe('bold');
    expect(node.style.color).toBe('var(--vscode-terminal-ansiGreen, #0dbc79)');
  });

  it('resets styling when reset code is encountered', () => {
    const esc = String.fromCharCode(27);
    render(<BashOutput command="ls" output={`${esc}[31mred${esc}[0mnormal`} status="completed" />);
    const redNode = screen.getByText('red');
    expect(redNode.style.color).toBe('var(--vscode-terminal-ansiRed, #cd3131)');
    const normalNode = screen.getByText('normal');
    expect(normalNode.style.color).toBe('');
  });

  it('returns null when output is empty', () => {
    const { container } = render(<BashOutput command="ls" output="" status="running" />);

    expect(container.querySelector('.tool-bash-output')).not.toBeInTheDocument();
  });

  it('regression: auto-scrolls to bottom when new output arrives and user is at bottom', () => {
    const { rerender, container } = render(
      <BashOutput command="ls" output="initial output" status="running" />,
    );

    // Simulate the scroll element being set
    const scrollContainer = container.querySelector('.bash-output-scroll');
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
    const { rerender, container } = render(
      <BashOutput command="ls" output="initial output" status="running" />,
    );

    const scrollContainer = container.querySelector('.bash-output-scroll');
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

  it('parses and renders multiline output correctly', () => {
    const nl = String.fromCharCode(10);
    const { container } = render(
      <BashOutput command="ls" output={`line1${nl}line2${nl}line3`} status="completed" />,
    );
    const preEl = container.querySelector('pre');
    expect(preEl).toBeInTheDocument();
    expect(preEl?.textContent).toBe(`line1${nl}line2${nl}line3`);
  });

  it('handles empty string segments within multiple adjacent ANSI escape codes correctly', () => {
    const esc = String.fromCharCode(27);
    // Adjacent styles: red (31) then bold (1)
    render(
      <BashOutput command="ls" output={`${esc}[31m${esc}[1mboldred${esc}[0m`} status="completed" />,
    );
    const node = screen.getByText('boldred');
    expect(node).toBeInTheDocument();
    expect(node.style.color).toBe('var(--vscode-terminal-ansiRed, #cd3131)');
    expect(node.style.fontWeight).toBe('bold');
  });
});
