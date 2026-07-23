/**
 * @file Unit tests for ChatView — message rendering and empty state.
 */

import { act, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockAssistantMessage, createMockUserMessage } from '../../test/mocks/sdk';
import { useSessionStore } from '../store/sessionStore';
import type { ChatViewHandle } from './ChatView';
import { ChatView } from './ChatView';

/** Installs mocked scroll geometry on the .chat-view element. */
function mockChatViewGeometry(chatView: HTMLDivElement): void {
  Object.defineProperty(chatView, 'scrollHeight', { configurable: true, value: 500 });
  Object.defineProperty(chatView, 'clientHeight', { configurable: true, value: 200 });
  Object.defineProperty(chatView, 'scrollTop', { configurable: true, writable: true, value: 0 });
}

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
    mockChatViewGeometry(chatView);

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
    mockChatViewGeometry(chatView);

    // Simulate scroll up (not at bottom)
    act(() => {
      chatView.scrollTop = 100;
      chatView.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true }));
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
      expect(screen.queryByText('To User Message')).not.toBeInTheDocument();
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
      expect(screen.getByText('To User Message')).toBeInTheDocument();
    });
  });

  describe('triggerScrollToBottom', () => {
    it('exposes triggerScrollToBottom method via ref', () => {
      const ref = createRef<ChatViewHandle>();
      render(<ChatView ref={ref} sessionID="session-1" messages={[]} parts={{}} />);

      expect(ref.current).toBeDefined();
      expect(ref.current?.triggerScrollToBottom).toBeInstanceOf(Function);
    });

    it('forces scroll to bottom when triggerScrollToBottom is called after user scrolled up', () => {
      const ref = createRef<ChatViewHandle>();
      const { container, rerender } = render(
        <ChatView ref={ref} sessionID="session-1" messages={[]} parts={{}} />,
      );

      const chatView = container.querySelector('.chat-view') as HTMLDivElement;
      mockChatViewGeometry(chatView);

      // Simulate user scrolling up (not at bottom)
      act(() => {
        chatView.scrollTop = 100;
        chatView.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true }));
        chatView.dispatchEvent(new Event('scroll'));
      });

      // Verify auto-scroll is disabled after user scrolls up
      const userMsg = createMockUserMessage();
      act(() => {
        rerender(<ChatView ref={ref} sessionID="session-1" messages={[userMsg]} parts={{}} />);
      });
      expect(chatView.scrollTop).toBe(100);

      // Call triggerScrollToBottom to force scroll back to bottom
      act(() => {
        ref.current?.triggerScrollToBottom();
      });

      // Verify scroll position is now at bottom
      expect(chatView.scrollTop).toBe(500);
    });
  });

  describe('session switch', () => {
    it('regression: scrolls to bottom when active session changes after user scrolled up in previous session', () => {
      // Regression: the ScrollFadeContainer's shouldStickToBottomRef persists
      // across re-renders, so when the user scrolls up in session A the ref
      // flips to false. Switching to session B must reset this state,
      // otherwise the new session's messages inherit the "do not auto-scroll"
      // flag and the list stays stuck mid-history.
      const { container, rerender } = render(
        <ChatView sessionID="session-A" messages={[]} parts={{}} />,
      );

      const chatView = container.querySelector('.chat-view') as HTMLDivElement;
      mockChatViewGeometry(chatView);

      // Simulate the user scrolling up in session A (not at bottom).
      act(() => {
        chatView.scrollTop = 100;
        chatView.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true }));
        chatView.dispatchEvent(new Event('scroll'));
      });

      // Sanity check: auto-scroll is now disabled in session A.
      act(() => {
        rerender(
          <ChatView sessionID="session-A" messages={[createMockUserMessage()]} parts={{}} />,
        );
      });
      expect(chatView.scrollTop).toBe(100);

      // Switch to session B with its own messages.
      act(() => {
        rerender(
          <ChatView
            sessionID="session-B"
            messages={[
              { ...createMockUserMessage(), id: 'msg-B-1', sessionID: 'session-B' },
              { ...createMockAssistantMessage(), id: 'msg-B-2', sessionID: 'session-B' },
            ]}
            parts={{}}
          />,
        );
      });

      // The chat must be anchored at the bottom of session B regardless of
      // where the user had scrolled in session A.
      expect(chatView.scrollTop).toBe(500);
    });

    it('regression: keeps the chat pinned to the bottom when the same session is re-rendered with new messages (auto-scroll intact)', () => {
      // Companion coverage: confirms the new useLayoutEffect does not break the
      // "stay at bottom while the active session streams new messages" path.
      const { container, rerender } = render(
        <ChatView sessionID="session-1" messages={[]} parts={{}} />,
      );

      const chatView = container.querySelector('.chat-view') as HTMLDivElement;
      mockChatViewGeometry(chatView);

      // Park the user at the bottom of session 1.
      act(() => {
        chatView.scrollTop = 300;
        chatView.dispatchEvent(new Event('scroll'));
      });

      // New messages arrive for the same session — should stay at bottom.
      act(() => {
        rerender(
          <ChatView
            sessionID="session-1"
            messages={[createMockUserMessage(), createMockAssistantMessage()]}
            parts={{}}
          />,
        );
      });
      expect(chatView.scrollTop).toBe(500);
    });
  });
});
