/**
 * @file Unit tests for ChatView — message rendering and empty state.
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockAssistantMessage, createMockUserMessage } from '../../test/mocks/sdk';
import { useSessionStore } from '../store/sessionStore';
import { ChatView } from './ChatView';

vi.mock('@vscode/webview-ui-toolkit/react', () => ({
  VSCodeButton: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

describe('ChatView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.setState({
      pendingPermission: null,
    });
  });

  it('renders messages', () => {
    const userMsg = createMockUserMessage();
    const assistantMsg = createMockAssistantMessage();
    const messages = [userMsg, assistantMsg];

    const { container } = render(
      <ChatView
        sessionID="session-1"
        messages={messages}
        parts={{}}
        onPermissionReply={() => {}}
      />,
    );

    expect(container.querySelector('.user-message')).toBeInTheDocument();
    expect(container.querySelector('.assistant-message')).toBeInTheDocument();
  });

  it('renders empty state when no messages', () => {
    render(
      <ChatView sessionID="session-1" messages={[]} parts={{}} onPermissionReply={() => {}} />,
    );

    expect(screen.getByText('Start a conversation by typing a message below.')).toBeInTheDocument();
  });
});
