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

  it('groups multiple consecutive assistant messages into a single turn', () => {
    const userMsg = createMockUserMessage();
    const assistantMsg1 = { ...createMockAssistantMessage(), id: 'msg-2' };
    const assistantMsg2 = { ...createMockAssistantMessage(), id: 'msg-3' };
    const messages = [userMsg, assistantMsg1, assistantMsg2];

    const { container } = render(
      <ChatView
        sessionID="session-1"
        messages={messages}
        parts={{}}
        onPermissionReply={() => {}}
      />,
    );

    // There should only be one message turn (one .message-turn container)
    expect(container.querySelectorAll('.message-turn')).toHaveLength(1);
    // But it should contain multiple assistant messages
    expect(container.querySelectorAll('.assistant-message')).toHaveLength(2);
  });

  it('renders empty state when no messages', () => {
    render(
      <ChatView sessionID="session-1" messages={[]} parts={{}} onPermissionReply={() => {}} />,
    );

    expect(screen.getByText('Start a conversation by typing a message below.')).toBeInTheDocument();
  });
});
