/**
 * @file Unit tests for SessionTabs — tab rendering, active highlighting, switch/close actions.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockSession, createMockSessionStatus } from '../../test/mocks/sdk';
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
        sessionStatus={{}}
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
        sessionStatus={{}}
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
        sessionStatus={{}}
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
        sessionStatus={{}}
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
        sessionStatus={{}}
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
          sessionStatus={{}}
          onSwitch={() => {}}
          onClose={() => {}}
        />,
      );

      // Initial render should not trigger scrollIntoView (prevActiveSessionIDRef
      // is initialized to the same value, so there is no "change" on mount).
      expect(scrollIntoViewSpy).not.toHaveBeenCalled();

      // Change activeSessionID and rerender to verify auto-scroll fires
      rerender(
        <SessionTabs
          sessions={sessions}
          activeSessionID="session-2"
          sessionStatus={{}}
          onSwitch={() => {}}
          onClose={() => {}}
        />,
      );

      // scrollIntoView should be called once when the active session actually changes
      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
      expect(scrollIntoViewSpy).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    } finally {
      // Restore original scrollIntoView
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it('does NOT scroll into view when a non-active tab is closed', () => {
    const scrollIntoViewSpy = vi.fn();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoViewSpy;

    try {
      const sessions = [
        createMockSession({ id: 'session-1', title: 'Session 1' }),
        createMockSession({ id: 'session-2', title: 'Session 2' }),
        createMockSession({ id: 'session-3', title: 'Session 3' }),
      ];

      const { rerender } = render(
        <SessionTabs
          sessions={sessions}
          activeSessionID="session-3"
          sessionStatus={{}}
          onSwitch={() => {}}
          onClose={() => {}}
        />,
      );

      // Initial render triggers scroll (activeSessionID differs from initial ref null)
      scrollIntoViewSpy.mockClear();

      // Close session-1 (a non-active tab) — activeSessionID stays the same
      const updatedSessions = sessions.filter((s) => s.id !== 'session-1');
      rerender(
        <SessionTabs
          sessions={updatedSessions}
          activeSessionID="session-3"
          sessionStatus={{}}
          onSwitch={() => {}}
          onClose={() => {}}
        />,
      );

      // scrollIntoView should NOT be called when closing a non-active tab
      expect(scrollIntoViewSpy).not.toHaveBeenCalled();
    } finally {
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
        sessionStatus={{}}
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
        sessionStatus={{}}
        onSwitch={() => {}}
        onClose={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'More Actions' })).toBeInTheDocument();
  });

  it('shows a running spinner on tabs whose session status is busy', () => {
    const sessions = [
      createMockSession({ id: 'session-busy', title: 'Busy Session' }),
      createMockSession({ id: 'session-idle', title: 'Idle Session' }),
    ];
    const sessionStatus = {
      'session-busy': createMockSessionStatus({ type: 'busy' }),
      'session-idle': createMockSessionStatus({ type: 'idle' }),
    };

    render(
      <SessionTabs
        sessions={sessions}
        activeSessionID="session-idle"
        sessionStatus={sessionStatus}
        onSwitch={() => {}}
        onClose={() => {}}
      />,
    );

    const busyTab = screen.getByText('Busy Session').closest('.tab') as HTMLElement;
    const idleTab = screen.getByText('Idle Session').closest('.tab') as HTMLElement;

    expect(busyTab.querySelector('.tab-spinner.codicon-sync')).toBeInTheDocument();
    expect(idleTab.querySelector('.tab-spinner')).toBeNull();
  });

  it('shows a running spinner on tabs whose session status is retry', () => {
    const sessions = [createMockSession({ id: 'session-retry', title: 'Retry Session' })];
    const sessionStatus = {
      'session-retry': createMockSessionStatus({ type: 'retry' }),
    };

    render(
      <SessionTabs
        sessions={sessions}
        activeSessionID="session-retry"
        sessionStatus={sessionStatus}
        onSwitch={() => {}}
        onClose={() => {}}
      />,
    );

    const tab = screen.getByText('Retry Session').closest('.tab') as HTMLElement;
    expect(tab.querySelector('.tab-spinner.codicon-modifier-spin')).toBeInTheDocument();
  });

  it('keeps the spinner on the active tab when it is busy', () => {
    // Regression: a previous version considered the active tab's running state
    // implicit (via the stop button) and skipped the spinner; users want parity
    // across all tabs regardless of which one is active.
    const sessions = [createMockSession({ id: 'session-active', title: 'Active Busy' })];
    const sessionStatus = {
      'session-active': createMockSessionStatus({ type: 'busy' }),
    };

    render(
      <SessionTabs
        sessions={sessions}
        activeSessionID="session-active"
        sessionStatus={sessionStatus}
        onSwitch={() => {}}
        onClose={() => {}}
      />,
    );

    const activeTab = screen.getByText('Active Busy').closest('.tab') as HTMLElement;
    expect(activeTab).toHaveClass('active');
    expect(activeTab.querySelector('.tab-spinner')).toBeInTheDocument();
  });

  it('shows the running spinner inside the More menu popover for busy sessions', () => {
    const sessions = [
      createMockSession({ id: 's1', title: 'Session 1' }),
      createMockSession({ id: 's2', title: 'Session 2' }),
    ];
    const sessionStatus = {
      s1: createMockSessionStatus({ type: 'busy' }),
      s2: createMockSessionStatus({ type: 'idle' }),
    };

    // Force overflow so the More Actions button renders
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      value: 300,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      value: 200,
    });

    render(
      <SessionTabs
        sessions={sessions}
        activeSessionID="s2"
        sessionStatus={sessionStatus}
        onSwitch={() => {}}
        onClose={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'More Actions' }));

    // Both the tab and the popover option render the title; scope the lookup
    // to inside the popover so we are asserting against the menu row only.
    const popover = document.querySelector('.more-menu-popover') as HTMLElement;
    const busyOption = popover.querySelectorAll('.popover-option')[0] as HTMLElement;
    const idleOption = popover.querySelectorAll('.popover-option')[1] as HTMLElement;

    expect(busyOption.querySelector('.tab-spinner')).toBeInTheDocument();
    expect(idleOption.querySelector('.tab-spinner')).toBeNull();
  });

  it('creates a new session when double-clicking the empty area of the tabs list', () => {
    // Regression: a previous prototype attached the dblclick handler to the
    // outer .session-tabs container, which also fired when the user clicked
    // (twice) on a tab or its close button — both gestures the user expects
    // to switch/close, not create. The handler must be on .tabs-list and
    // must short-circuit unless the event target is the list itself.
    const sessions = [createMockSession({ id: 'session-1', title: 'Session 1' })];
    const onCreate = vi.fn();

    render(
      <SessionTabs
        sessions={sessions}
        activeSessionID="session-1"
        sessionStatus={{}}
        onSwitch={() => {}}
        onClose={() => {}}
        onCreate={onCreate}
      />,
    );

    const tabsList = document.querySelector('.tabs-list') as HTMLElement;
    expect(tabsList).not.toBeNull();
    fireEvent.doubleClick(tabsList);

    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('does NOT create a new session when double-clicking a tab', () => {
    // Regression: ensures the empty-area-only guard does not regress; the
    // event target of a double-click on a tab is the .tab element (or one of
    // its children), which is a descendant of .tabs-list, so the handler must
    // not invoke onCreate.
    const sessions = [
      createMockSession({ id: 'session-1', title: 'Session 1' }),
      createMockSession({ id: 'session-2', title: 'Session 2' }),
    ];
    const onCreate = vi.fn();

    render(
      <SessionTabs
        sessions={sessions}
        activeSessionID="session-1"
        sessionStatus={{}}
        onSwitch={() => {}}
        onClose={() => {}}
        onCreate={onCreate}
      />,
    );

    const tab = screen.getByText('Session 2').closest('.tab') as HTMLElement;
    fireEvent.doubleClick(tab);

    expect(onCreate).not.toHaveBeenCalled();
  });

  it('does NOT create a new session when double-clicking a tab close button', () => {
    // Regression: the close button uses stopPropagation on click to avoid
    // activating the tab, but dblclick is a distinct event family. The
    // empty-area guard (e.target === e.currentTarget) must still keep the
    // close button from accidentally triggering session creation.
    const sessions = [createMockSession({ id: 'session-1', title: 'Session 1' })];
    const onCreate = vi.fn();

    render(
      <SessionTabs
        sessions={sessions}
        activeSessionID="session-1"
        sessionStatus={{}}
        onSwitch={() => {}}
        onClose={() => {}}
        onCreate={onCreate}
      />,
    );

    const closeButton = screen.getByRole('button', { name: 'Close Session' });
    fireEvent.doubleClick(closeButton);

    expect(onCreate).not.toHaveBeenCalled();
  });
});
