/**
 * @file Unit tests for MessageTurn — user/assistant rendering, actions, and alignments.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMockAssistantMessage,
  createMockTextPart,
  createMockUserMessage,
} from '../../test/mocks/sdk';
import { MessageTurn } from './MessageTurn';

describe('MessageTurn', () => {
  let writeTextSpy: ReturnType<typeof vi.fn>;
  let scrollToSpy: ReturnType<typeof vi.fn>;
  let scrollIntoViewSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    writeTextSpy = vi.fn().mockImplementation(() => Promise.resolve());
    scrollToSpy = vi.fn();
    scrollIntoViewSpy = vi.fn();

    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextSpy,
      },
    });
    // Mock scrollTo and scrollIntoView
    Element.prototype.scrollTo = scrollToSpy;
    Element.prototype.scrollIntoView = scrollIntoViewSpy;
  });

  it('renders user message in user-message container without role title', () => {
    const userMsg = createMockUserMessage();

    const { container } = render(<MessageTurn userMessage={userMsg} parts={{}} />);

    expect(container.querySelector('.user-message')).toBeInTheDocument();
    expect(screen.queryByText('You')).not.toBeInTheDocument();
  });

  it('renders user message parts using PartRenderer', () => {
    const userMsg = createMockUserMessage();
    const textPart = createMockTextPart('Hello user message part!');
    textPart.messageID = userMsg.id;

    render(<MessageTurn userMessage={userMsg} parts={{ [userMsg.id]: [textPart] }} />);

    expect(screen.getByText('Hello user message part!')).toBeInTheDocument();
  });

  it('filters out synthetic user parts to avoid rendering file read logs or contents', () => {
    const userMsg = createMockUserMessage();
    const originalTextPart = createMockTextPart('User prompt question');
    originalTextPart.messageID = userMsg.id;

    const syntheticPart = createMockTextPart('Called the Read tool with the following input...');
    syntheticPart.id = 'synthetic-1';
    syntheticPart.messageID = userMsg.id;
    syntheticPart.synthetic = true;

    const fileContentPart = createMockTextPart('Changelog content...');
    fileContentPart.id = 'synthetic-2';
    fileContentPart.messageID = userMsg.id;
    fileContentPart.synthetic = true;

    render(
      <MessageTurn
        userMessage={userMsg}
        parts={{ [userMsg.id]: [originalTextPart, syntheticPart, fileContentPart] }}
      />,
    );

    expect(screen.getByText('User prompt question')).toBeInTheDocument();
    expect(
      screen.queryByText('Called the Read tool with the following input...'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Changelog content...')).not.toBeInTheDocument();
  });

  it('renders assistant message in assistant-message container without role title', () => {
    const userMsg = createMockUserMessage();
    const assistantMsg = createMockAssistantMessage();

    const { container } = render(
      <MessageTurn userMessage={userMsg} assistantMessage={assistantMsg} parts={{}} />,
    );

    expect(container.querySelector('.assistant-message')).toBeInTheDocument();
    expect(screen.queryByText('Assistant')).not.toBeInTheDocument();
  });

  it('does not render assistant section when not provided', () => {
    const userMsg = createMockUserMessage();

    const { container } = render(<MessageTurn userMessage={userMsg} parts={{}} />);

    expect(container.querySelector('.assistant-message')).not.toBeInTheDocument();
  });

  // Regression tests for new features (copy, scroll, status durations)
  describe('Action Controls Footer', () => {
    it('renders copy, scroll to top, and scroll to user buttons when message output ends', () => {
      const userMsg = createMockUserMessage();
      const assistantMsg = createMockAssistantMessage();

      render(
        <MessageTurn
          userMessage={userMsg}
          assistantMessage={assistantMsg}
          parts={{}}
          isGenerating={false}
        />,
      );

      expect(screen.getByText('Copy Answer').closest('button')).toHaveAttribute(
        'data-custom-title',
        'Copy Answer',
      );
      expect(screen.getByText('To Top').closest('button')).toHaveAttribute(
        'data-custom-title',
        'Scroll to top',
      );
      expect(screen.getByText('To Recent User').closest('button')).toHaveAttribute(
        'data-custom-title',
        'Scroll to recent user message',
      );
    });

    it('does not render action buttons when model is still generating output', () => {
      const userMsg = createMockUserMessage();
      const assistantMsg = createMockAssistantMessage();

      render(
        <MessageTurn
          userMessage={userMsg}
          assistantMessage={assistantMsg}
          parts={{}}
          isGenerating={true}
        />,
      );

      expect(screen.queryByText('Copy Answer')).not.toBeInTheDocument();
      expect(screen.queryByText('To Top')).not.toBeInTheDocument();
      expect(screen.queryByText('To Recent User')).not.toBeInTheDocument();
    });

    it('copies only text/markdown content when copy answer is clicked', () => {
      const userMsg = createMockUserMessage();
      const assistantMsg = createMockAssistantMessage();
      const textPart1 = createMockTextPart('Part one text content.');
      textPart1.messageID = assistantMsg.id;
      const textPart2 = createMockTextPart('Part two text content.');
      textPart2.id = 'part-2';
      textPart2.messageID = assistantMsg.id;

      // Add a reasoning part to verify it is filtered out of final copy
      const reasoningPart = {
        type: 'reasoning' as const,
        id: 'reasoning-1',
        sessionID: 'session-1',
        messageID: assistantMsg.id,
        text: 'Thinking text block.',
        time: { start: Date.now(), end: Date.now() },
      };

      const parts = {
        [assistantMsg.id]: [textPart1, reasoningPart, textPart2],
      };

      render(
        <MessageTurn
          userMessage={userMsg}
          assistantMessage={assistantMsg}
          parts={parts}
          isGenerating={false}
        />,
      );

      const copyBtn = screen.getByText('Copy Answer').closest('button')!;
      act(() => {
        fireEvent.click(copyBtn);
      });

      expect(writeTextSpy).toHaveBeenCalledWith('Part one text content.\nPart two text content.');
    });

    it('shows copy feedback when clicked and reverts after timeout', () => {
      vi.useFakeTimers();
      const userMsg = createMockUserMessage();
      const assistantMsg = createMockAssistantMessage();
      const textPart = createMockTextPart('Hello word!');
      textPart.messageID = assistantMsg.id;

      render(
        <MessageTurn
          userMessage={userMsg}
          assistantMessage={assistantMsg}
          parts={{ [assistantMsg.id]: [textPart] }}
          isGenerating={false}
        />,
      );

      const copyBtn = screen.getByText('Copy Answer').closest('button')!;
      expect(screen.getByText('Copy Answer')).toBeInTheDocument();

      act(() => {
        fireEvent.click(copyBtn);
      });

      expect(screen.getByText('Copied!')).toBeInTheDocument();
      expect(screen.getByText('Copied!').closest('button')).toHaveAttribute(
        'data-custom-title',
        'Copied!',
      );

      // Fast-forward 2 seconds to trigger timeout and state reversion
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.getByText('Copy Answer')).toBeInTheDocument();
      expect(screen.getByText('Copy Answer').closest('button')).toHaveAttribute(
        'data-custom-title',
        'Copy Answer',
      );

      vi.useRealTimers();
    });

    it('triggers scroll to top action when clicked', () => {
      const userMsg = createMockUserMessage();
      const assistantMsg = createMockAssistantMessage();

      // Create a mocked chat view DOM container so document.querySelector matches
      const chatViewDiv = document.createElement('div');
      chatViewDiv.className = 'chat-view';
      document.body.appendChild(chatViewDiv);

      render(
        <MessageTurn
          userMessage={userMsg}
          assistantMessage={assistantMsg}
          parts={{}}
          isGenerating={false}
        />,
      );

      const toTopBtn = screen.getByText('To Top').closest('button')!;
      fireEvent.click(toTopBtn);

      expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
      document.body.removeChild(chatViewDiv);
    });

    it('triggers scroll to user message when clicked', () => {
      const userMsg = createMockUserMessage();
      const assistantMsg = createMockAssistantMessage();

      // Create a mocked user message DOM container so querySelector matches
      const userMsgDiv = document.createElement('div');
      userMsgDiv.className = 'user-message';
      document.body.appendChild(userMsgDiv);

      render(
        <MessageTurn
          userMessage={userMsg}
          assistantMessage={assistantMsg}
          parts={{}}
          isGenerating={false}
        />,
      );

      const toUserBtn = screen.getByText('To Recent User').closest('button')!;
      fireEvent.click(toUserBtn);

      expect(scrollIntoViewSpy).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      });
      document.body.removeChild(userMsgDiv);
    });

    it('uses data-custom-title instead of native title on buttons to support custom tooltips', () => {
      const userMsg = createMockUserMessage();
      const assistantMsg = createMockAssistantMessage();

      render(
        <MessageTurn
          userMessage={userMsg}
          assistantMessage={assistantMsg}
          parts={{}}
          isGenerating={false}
        />,
      );

      // Verify that native title attributes are not present on buttons, and data-custom-title is used instead
      const buttons = screen.getAllByRole('button');
      buttons.forEach((btn) => {
        expect(btn).not.toHaveAttribute('title');
        if (btn.classList.contains('action-btn')) {
          expect(btn).toHaveAttribute('data-custom-title');
        }
      });
    });

    it('renders multiple assistant messages in assistant-message containers when assistantMessages is provided', () => {
      const userMsg = createMockUserMessage();
      const assistantMsg1 = { ...createMockAssistantMessage(), id: 'msg-2' };
      const assistantMsg2 = { ...createMockAssistantMessage(), id: 'msg-3' };

      const { container } = render(
        <MessageTurn
          userMessage={userMsg}
          assistantMessages={[assistantMsg1, assistantMsg2]}
          parts={{}}
          isGenerating={false}
        />,
      );

      expect(container.querySelectorAll('.assistant-message')).toHaveLength(2);
    });

    it('copies aggregated text of all assistant messages when copy answer is clicked with assistantMessages', () => {
      const userMsg = createMockUserMessage();
      const assistantMsg1 = { ...createMockAssistantMessage(), id: 'msg-2' };
      const assistantMsg2 = { ...createMockAssistantMessage(), id: 'msg-3' };
      const textPart1 = createMockTextPart('Text from assistant 1.');
      textPart1.messageID = assistantMsg1.id;
      const textPart2 = createMockTextPart('Text from assistant 2.');
      textPart2.id = 'part-2';
      textPart2.messageID = assistantMsg2.id;

      const parts = {
        [assistantMsg1.id]: [textPart1],
        [assistantMsg2.id]: [textPart2],
      };

      render(
        <MessageTurn
          userMessage={userMsg}
          assistantMessages={[assistantMsg1, assistantMsg2]}
          parts={parts}
          isGenerating={false}
        />,
      );

      const copyBtn = screen.getByText('Copy Answer').closest('button')!;
      act(() => {
        fireEvent.click(copyBtn);
      });

      expect(writeTextSpy).toHaveBeenCalledWith('Text from assistant 1.\nText from assistant 2.');
    });
  });
});
