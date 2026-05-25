/**
 * @file Unit tests for ChatView — message rendering and empty state.
 */

import { act, render, screen } from '@testing-library/react';
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
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => cb(performance.now()));
    useSessionStore.setState({
      pendingPermissions: [],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders messages', () => {
    const userMsg = createMockUserMessage();
    const assistantMsg = createMockAssistantMessage();
    const messages = [userMsg, assistantMsg];

    const { container } = render(<ChatView sessionID="session-1" messages={messages} parts={{}} />);

    expect(container.querySelector('.user-message')).toBeInTheDocument();
    expect(container.querySelector('.assistant-message')).toBeInTheDocument();
  });

  it('groups multiple consecutive assistant messages into a single turn', () => {
    const userMsg = createMockUserMessage();
    const assistantMsg1 = { ...createMockAssistantMessage(), id: 'msg-2' };
    const assistantMsg2 = { ...createMockAssistantMessage(), id: 'msg-3' };
    const messages = [userMsg, assistantMsg1, assistantMsg2];

    const { container } = render(<ChatView sessionID="session-1" messages={messages} parts={{}} />);

    // There should only be one message turn (one .message-turn container)
    expect(container.querySelectorAll('.message-turn')).toHaveLength(1);
    // But it should contain multiple assistant messages
    expect(container.querySelectorAll('.assistant-message')).toHaveLength(2);
  });

  it('renders empty state when no messages', () => {
    render(<ChatView sessionID="session-1" messages={[]} parts={{}} />);

    expect(screen.getByText('Start a conversation by typing a message below.')).toBeInTheDocument();
  });

  it('enables auto-scroll when scrolled to bottom', () => {
    const { container, rerender } = render(
      <ChatView sessionID="session-1" messages={[]} parts={{}} />,
    );

    const chatView = container.querySelector('.chat-view') as HTMLDivElement;

    // Mock the scroll properties
    Object.defineProperty(chatView, 'scrollHeight', { configurable: true, value: 500 });
    Object.defineProperty(chatView, 'clientHeight', { configurable: true, value: 200 });
    Object.defineProperty(chatView, 'scrollTop', { configurable: true, writable: true, value: 0 });

    // Simulate scroll to bottom
    act(() => {
      chatView.scrollTop = 300;
      chatView.dispatchEvent(new Event('scroll'));
    });

    // Verify auto-scroll on new message
    const userMsg = createMockUserMessage();
    rerender(<ChatView sessionID="session-1" messages={[userMsg]} parts={{}} />);

    expect(chatView.scrollTop).toBe(500);
  });

  it('disables auto-scroll when user scrolls up', () => {
    const { container, rerender } = render(
      <ChatView sessionID="session-1" messages={[]} parts={{}} />,
    );

    const chatView = container.querySelector('.chat-view') as HTMLDivElement;

    // Mock the scroll properties
    Object.defineProperty(chatView, 'scrollHeight', { configurable: true, value: 500 });
    Object.defineProperty(chatView, 'clientHeight', { configurable: true, value: 200 });
    Object.defineProperty(chatView, 'scrollTop', { configurable: true, writable: true, value: 0 });

    // Simulate scroll up (not at bottom)
    act(() => {
      chatView.scrollTop = 100;
      chatView.dispatchEvent(new Event('scroll'));
    });

    // Verify auto-scroll remains disabled on new message
    const userMsg = createMockUserMessage();
    rerender(<ChatView sessionID="session-1" messages={[userMsg]} parts={{}} />);

    expect(chatView.scrollTop).toBe(100);
  });

  describe('Session Status Actions rendering', () => {
    it('does not render actions buttons in the message turn when sessionStatus is busy', () => {
      const userMsg = createMockUserMessage();
      const assistantMsg = createMockAssistantMessage();
      const messages = [userMsg, assistantMsg];

      useSessionStore.setState({
        sessionStatus: {
          'session-1': { type: 'busy' },
        },
      });

      render(<ChatView sessionID="session-1" messages={messages} parts={{}} />);

      expect(screen.queryByText('Copy Answer')).not.toBeInTheDocument();
      expect(screen.queryByText('To Top')).not.toBeInTheDocument();
      expect(screen.queryByText('To Recent User')).not.toBeInTheDocument();
    });

    it('renders actions buttons in the message turn when sessionStatus is idle', () => {
      const userMsg = createMockUserMessage();
      const assistantMsg = createMockAssistantMessage();
      const messages = [userMsg, assistantMsg];

      useSessionStore.setState({
        sessionStatus: {
          'session-1': { type: 'idle' },
        },
      });

      render(<ChatView sessionID="session-1" messages={messages} parts={{}} />);

      expect(screen.getByText('Copy Answer')).toBeInTheDocument();
      expect(screen.getByText('To Top')).toBeInTheDocument();
      expect(screen.getByText('To Recent User')).toBeInTheDocument();
    });
  });
});
