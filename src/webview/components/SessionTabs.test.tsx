import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockSession } from '../../test/mocks/sdk';
import { SessionTabs } from './SessionTabs';

vi.mock('@vscode/webview-ui-toolkit/react', () => ({
  VSCodeButton: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

describe('SessionTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
        onCreate={() => {}}
        onArchive={() => {}}
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
        onCreate={() => {}}
        onArchive={() => {}}
      />,
    );

    const tabs = screen.getAllByRole('button');
    expect(tabs[0]).not.toHaveClass('active');
    expect(tabs[1]).toHaveClass('active');
  });

  it('calls onSwitch when tab is clicked', () => {
    const sessions = [createMockSession({ id: 'session-1', title: 'Session 1' })];
    const onSwitch = vi.fn();

    render(
      <SessionTabs
        sessions={sessions}
        activeSessionID={null}
        onSwitch={onSwitch}
        onCreate={() => {}}
        onArchive={() => {}}
      />,
    );

    fireEvent.click(screen.getByText('Session 1'));
    expect(onSwitch).toHaveBeenCalledWith('session-1');
  });

  it('calls onCreate when new button is clicked', () => {
    const onCreate = vi.fn();

    render(
      <SessionTabs
        sessions={[]}
        activeSessionID={null}
        onSwitch={() => {}}
        onCreate={onCreate}
        onArchive={() => {}}
      />,
    );

    fireEvent.click(screen.getByText('+ New'));
    expect(onCreate).toHaveBeenCalled();
  });
});
