/**
 * @file Unit tests for SessionTabs — tab rendering, active highlighting, switch/close actions.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockSession } from '../../test/mocks/sdk';
import { SessionTabs } from './SessionTabs';

// Mock ResizeObserver globally for this test suite
class MockResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
global.ResizeObserver = MockResizeObserver;

vi.mock('@vscode/webview-ui-toolkit/react', () => ({
  VSCodeButton: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

describe('SessionTabs', () => {
  const originalScrollWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');
  const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalScrollWidth) {
      Object.defineProperty(HTMLElement.prototype, 'scrollWidth', originalScrollWidth);
    }
    if (originalClientWidth) {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
    }
  });

  it('renders tabs for all sessions', () => {
    const sessions = [
      createMockSession({ id: 'session-1', title: 'Session 1' }),
      createMockSession({ id: 'session-2', title: 'Session 2' }),
    ];

    render(
      <SessionTabs
        sessions={sessions}
        activeSessionID="session-1"
        onSwitch={() => {}}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText('Session 1')).toBeInTheDocument();
    expect(screen.getByText('Session 2')).toBeInTheDocument();
  });

  it('highlights active session tab', () => {
    const sessions = [
      createMockSession({ id: 'session-1', title: 'Session 1' }),
      createMockSession({ id: 'session-2', title: 'Session 2' }),
    ];

    render(
      <SessionTabs
        sessions={sessions}
        activeSessionID="session-2"
        onSwitch={() => {}}
        onClose={() => {}}
      />,
    );

    const activeTab = screen.getByText('Session 2').closest('.tab');
    expect(activeTab).toHaveClass('active');
  });

  it('calls onSwitch when tab is clicked', () => {
    const sessions = [createMockSession({ id: 'session-1', title: 'Session 1' })];
    const onSwitch = vi.fn();

    render(
      <SessionTabs
        sessions={sessions}
        activeSessionID={null}
        onSwitch={onSwitch}
        onClose={() => {}}
      />,
    );

    fireEvent.click(screen.getByText('Session 1'));
    expect(onSwitch).toHaveBeenCalledWith('session-1');
  });

  it('calls onClose when close button is clicked', () => {
    const sessions = [createMockSession({ id: 'session-1', title: 'Session 1' })];
    const onClose = vi.fn();

    render(
      <SessionTabs
        sessions={sessions}
        activeSessionID="session-1"
        onSwitch={() => {}}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close Session' }));
    expect(onClose).toHaveBeenCalledWith('session-1');
  });

  it('supports horizontal scrolling via mouse wheel', () => {
    const sessions = [
      createMockSession({ id: 's1', title: 'Session 1' }),
      createMockSession({ id: 's2', title: 'Session 2' }),
      createMockSession({ id: 's3', title: 'Session 3' }),
      createMockSession({ id: 's4', title: 'Session 4' }),
      createMockSession({ id: 's5', title: 'Session 5' }),
    ];

    render(
      <SessionTabs
        sessions={sessions}
        activeSessionID="s1"
        onSwitch={() => {}}
        onClose={() => {}}
      />,
    );

    const tabsList = document.querySelector('.tabs-list');
    expect(tabsList).not.toBeNull();

    // Mock scrollLeft property
    Object.defineProperty(tabsList, 'scrollLeft', {
      writable: true,
      value: 0,
      configurable: true,
    });

    const wheelEvent = new WheelEvent('wheel', { deltaY: 100, bubbles: true });
    fireEvent(tabsList!, wheelEvent);

    expect((tabsList as HTMLElement & { scrollLeft: number }).scrollLeft).toBe(100);
  });

  it('automatically scrolls active tab into view when active session changes', () => {
    const scrollIntoViewSpy = vi.fn();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoViewSpy;

    try {
      const sessions = [
        createMockSession({ id: 'session-1', title: 'Session 1' }),
        createMockSession({ id: 'session-2', title: 'Session 2' }),
      ];

      const { rerender } = render(
        <SessionTabs
          sessions={sessions}
          activeSessionID="session-1"
          onSwitch={() => {}}
          onClose={() => {}}
        />,
      );

      // Verifies scrollIntoView is called upon initial render/mount for the active session
      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
      expect(scrollIntoViewSpy).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });

      // Change activeSessionID and rerender to verify auto-scroll fires again
      rerender(
        <SessionTabs
          sessions={sessions}
          activeSessionID="session-2"
          onSwitch={() => {}}
          onClose={() => {}}
        />,
      );

      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(2);
    } finally {
      // Restore original scrollIntoView
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it('renders "More Actions" menu only when session tabs overflow', () => {
    const sessions = [
      createMockSession({ id: 's1', title: 'Session 1' }),
      createMockSession({ id: 's2', title: 'Session 2' }),
    ];

    // Mock scrollWidth and clientWidth to simulate NO overflow
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      value: 200,
    });

    const { rerender } = render(
      <SessionTabs
        sessions={sessions}
        activeSessionID="s1"
        onSwitch={() => {}}
        onClose={() => {}}
      />,
    );

    expect(screen.queryByRole('button', { name: 'More Actions' })).not.toBeInTheDocument();

    // Now mock scrollWidth and clientWidth to simulate overflow
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      value: 300,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      value: 200,
    });

    // Rerender to trigger useEffect ResizeObserver check
    rerender(
      <SessionTabs
        sessions={[...sessions]}
        activeSessionID="s1"
        onSwitch={() => {}}
        onClose={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'More Actions' })).toBeInTheDocument();
  });
});
