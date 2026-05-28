/**
 * @file Unit tests for MessageTurn — user/assistant rendering, actions, and alignments.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMockAssistantMessage,
  createMockReasoningPart,
  createMockTextPart,
  createMockToolPart,
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
          isLastTurn={true}
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
      expect(screen.getByText('To User Message').closest('button')).toHaveAttribute(
        'data-custom-title',
        'Scroll to user message',
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
      expect(screen.queryByText('To User Message')).not.toBeInTheDocument();
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
          isLastTurn={true}
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
          isLastTurn={true}
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
          isLastTurn={true}
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

      render(
        <MessageTurn
          userMessage={userMsg}
          assistantMessage={assistantMsg}
          parts={{}}
          isGenerating={false}
          isLastTurn={true}
        />,
      );

      const toUserBtn = screen.getByText('To User Message').closest('button')!;
      fireEvent.click(toUserBtn);

      // 验证 scrollIntoView 被调用（用户消息元素由组件自身渲染）
      expect(scrollIntoViewSpy).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      });
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
          isLastTurn={true}
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
          isLastTurn={true}
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
          isLastTurn={true}
        />,
      );

      const copyBtn = screen.getByText('Copy Answer').closest('button')!;
      act(() => {
        fireEvent.click(copyBtn);
      });

      expect(writeTextSpy).toHaveBeenCalledWith('Text from assistant 1.\nText from assistant 2.');
    });
  });

  it('regression: renders both text parts and file/chip parts inline in user message bubble', () => {
    const userMsg = createMockUserMessage();
    const textPart = createMockTextPart(
      '[Code Selection: main.ts [1-10]] Explain this code and look at [Terminal: 5 lines]',
    );
    textPart.messageID = userMsg.id;

    const filePart = {
      type: 'file' as const,
      id: 'part-file',
      sessionID: 'session-1',
      messageID: userMsg.id,
      mime: 'text/plain',
      url: 'file:///src/main.ts',
      filename: 'main.ts [1-10]',
      source: {
        type: 'file' as const,
        path: 'src/main.ts',
        text: {
          value: 'const x = 1;',
          start: 1,
          end: 10,
        },
      },
    };

    const terminalPart = {
      type: 'file' as const,
      id: 'part-terminal',
      sessionID: 'session-1',
      messageID: userMsg.id,
      mime: 'text/plain',
      url: 'data:text/plain;base64,ZXJyb3I=',
      filename: 'terminal [5 lines]',
      source: {
        type: 'file' as const,
        path: 'terminal-part-terminal',
        text: {
          value: 'error',
          start: 1,
          end: 5,
        },
      },
    };

    render(
      <MessageTurn
        userMessage={userMsg}
        parts={{ [userMsg.id]: [textPart, filePart, terminalPart] }}
      />,
    );

    // Verify text parts render
    expect(screen.getByText('Explain this code and look at')).toBeInTheDocument();
    // Verify file part (chip) renders inline
    expect(screen.getByText('main.ts [1-10]')).toBeInTheDocument();
    // Verify terminal part (chip) renders inline
    expect(screen.getByText('terminal [5 lines]')).toBeInTheDocument();
  });

  it('regression: renders inline file references without source offsets as line ranges', () => {
    const userMsg = createMockUserMessage();
    const textPart = createMockTextPart('[File: merges.txt] 这个文件是什么的');
    textPart.messageID = userMsg.id;

    const filePart = {
      type: 'file' as const,
      id: 'part-file-reference',
      sessionID: 'session-1',
      messageID: userMsg.id,
      mime: 'text/plain',
      url: 'file:///workspace/merges.txt',
      filename: 'merges.txt',
      source: {
        type: 'file' as const,
        path: 'src/qwenpaw/tokenizer/merges.txt',
        text: {
          value: '[File: merges.txt]',
          start: 1,
          end: 1,
        },
      },
    };

    const { container } = render(
      <MessageTurn userMessage={userMsg} parts={{ [userMsg.id]: [textPart, filePart] }} />,
    );

    const chipElement = container.querySelector('.opencode-chip');
    expect(chipElement).toBeInTheDocument();
    expect(chipElement).toHaveClass('file-chip');
    expect(chipElement).not.toHaveClass('code-selection-chip');
    expect(screen.getByText('merges.txt')).toBeInTheDocument();
    expect(screen.getByText('这个文件是什么的')).toBeInTheDocument();
    expect(screen.queryByText('merges.txt [1-1]')).not.toBeInTheDocument();
  });

  it('correctly calculates hasPredecessor and hasSuccessor props ignoring empty/whitespace text parts', () => {
    const userMsg = createMockUserMessage();
    const assistantMsg = createMockAssistantMessage();

    const reasoningPart = createMockReasoningPart('thinking...');
    reasoningPart.id = 'part-reasoning-1';
    reasoningPart.messageID = assistantMsg.id;

    const emptyTextPart = createMockTextPart('   \n  \n ');
    emptyTextPart.id = 'part-text-empty';
    emptyTextPart.messageID = assistantMsg.id;

    const toolPart = createMockToolPart('bash');
    toolPart.id = 'part-tool-1';
    toolPart.messageID = assistantMsg.id;

    const { container } = render(
      <MessageTurn
        userMessage={userMsg}
        assistantMessage={assistantMsg}
        parts={{ [assistantMsg.id]: [reasoningPart, emptyTextPart, toolPart] }}
      />,
    );

    const reasoningLine = container.querySelector('.reasoning-part .timeline-line');
    expect(reasoningLine).toBeInTheDocument();
    expect(reasoningLine).toHaveClass('has-successor');
    expect(reasoningLine).not.toHaveClass('has-predecessor');

    const toolLine = container.querySelector('.tool-part .timeline-line');
    expect(toolLine).toBeInTheDocument();
    expect(toolLine).toHaveClass('has-predecessor');
    expect(toolLine).not.toHaveClass('has-successor');
  });

  it('correctly calculates hasPredecessor and hasSuccessor props across multiple assistant messages', () => {
    const userMsg = createMockUserMessage();
    const assistantMsg1 = { ...createMockAssistantMessage(), id: 'msg-1' };
    const assistantMsg2 = { ...createMockAssistantMessage(), id: 'msg-2' };

    const reasoningPart = createMockReasoningPart('thinking...');
    reasoningPart.id = 'part-reasoning-1';
    reasoningPart.messageID = assistantMsg1.id;

    const toolPart = createMockToolPart('bash');
    toolPart.id = 'part-tool-1';
    toolPart.messageID = assistantMsg2.id;

    const { container } = render(
      <MessageTurn
        userMessage={userMsg}
        assistantMessages={[assistantMsg1, assistantMsg2]}
        parts={{
          [assistantMsg1.id]: [reasoningPart],
          [assistantMsg2.id]: [toolPart],
        }}
      />,
    );

    const reasoningLine = container.querySelector('.reasoning-part .timeline-line');
    expect(reasoningLine).toBeInTheDocument();
    expect(reasoningLine).toHaveClass('has-successor');
    expect(reasoningLine).not.toHaveClass('has-predecessor');

    const toolLine = container.querySelector('.tool-part .timeline-line');
    expect(toolLine).toBeInTheDocument();
    expect(toolLine).toHaveClass('has-predecessor');
    expect(toolLine).not.toHaveClass('has-successor');
  });

  describe('ThinkingDots Indicator', () => {
    it('renders thinking dots when generating and no parts exist', () => {
      const userMsg = createMockUserMessage();
      const assistantMsg = createMockAssistantMessage();

      const { container } = render(
        <MessageTurn
          userMessage={userMsg}
          assistantMessage={assistantMsg}
          parts={{}}
          isGenerating={true}
        />,
      );

      const dots = container.querySelector('.thinking-dots');
      expect(dots).toBeInTheDocument();
      expect(dots?.querySelectorAll('.dot')).toHaveLength(3);
    });

    it('renders thinking dots when generating even if parts exist', () => {
      const userMsg = createMockUserMessage();
      const assistantMsg = createMockAssistantMessage();
      const textPart = createMockTextPart('Hello!');
      textPart.messageID = assistantMsg.id;

      const { container } = render(
        <MessageTurn
          userMessage={userMsg}
          assistantMessage={assistantMsg}
          parts={{ [assistantMsg.id]: [textPart] }}
          isGenerating={true}
        />,
      );

      const dots = container.querySelector('.thinking-dots');
      expect(dots).toBeInTheDocument();
      expect(dots?.querySelectorAll('.dot')).toHaveLength(3);
    });

    it('does not render thinking dots when not generating', () => {
      const userMsg = createMockUserMessage();
      const assistantMsg = createMockAssistantMessage();
      const textPart = createMockTextPart('Hello!');
      textPart.messageID = assistantMsg.id;

      const { container } = render(
        <MessageTurn
          userMessage={userMsg}
          assistantMessage={assistantMsg}
          parts={{ [assistantMsg.id]: [textPart] }}
          isGenerating={false}
        />,
      );

      expect(container.querySelector('.thinking-dots')).not.toBeInTheDocument();
    });
  });

  describe('Fork button', () => {
    it('renders fork button when onFork callback is provided', () => {
      const userMsg = createMockUserMessage();
      const assistantMsg = createMockAssistantMessage();

      render(
        <MessageTurn
          userMessage={userMsg}
          assistantMessage={assistantMsg}
          parts={{}}
          onFork={vi.fn()}
        />,
      );

      expect(screen.getByTestId('fork-btn')).toBeInTheDocument();
      expect(screen.getByText('Fork')).toBeInTheDocument();
    });

    it('does not render fork button when onFork is not provided', () => {
      const userMsg = createMockUserMessage();
      const assistantMsg = createMockAssistantMessage();

      render(<MessageTurn userMessage={userMsg} assistantMessage={assistantMsg} parts={{}} />);

      expect(screen.queryByTestId('fork-btn')).not.toBeInTheDocument();
    });

    it('disables fork button when session is busy', () => {
      const userMsg = createMockUserMessage();
      const assistantMsg = createMockAssistantMessage();

      render(
        <MessageTurn
          userMessage={userMsg}
          assistantMessage={assistantMsg}
          parts={{}}
          isSessionBusy={true}
          onFork={vi.fn()}
        />,
      );

      const forkBtn = screen.getByTestId('fork-btn');
      expect(forkBtn).toBeDisabled();
    });

    it('enables fork button when session is idle', () => {
      const userMsg = createMockUserMessage();
      const assistantMsg = createMockAssistantMessage();

      render(
        <MessageTurn
          userMessage={userMsg}
          assistantMessage={assistantMsg}
          parts={{}}
          isSessionBusy={false}
          onFork={vi.fn()}
        />,
      );

      const forkBtn = screen.getByTestId('fork-btn');
      expect(forkBtn).not.toBeDisabled();
    });

    it('opens fork confirmation dialog when fork button is clicked', () => {
      const userMsg = createMockUserMessage();
      const assistantMsg = createMockAssistantMessage();

      render(
        <MessageTurn
          userMessage={userMsg}
          assistantMessage={assistantMsg}
          parts={{}}
          onFork={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByTestId('fork-btn'));

      expect(screen.getByText('Fork from Message')).toBeInTheDocument();
    });

    it('calls onFork with message ID when fork is confirmed', () => {
      const onFork = vi.fn();
      const userMsg = createMockUserMessage();
      const assistantMsg = createMockAssistantMessage();

      render(
        <MessageTurn
          userMessage={userMsg}
          assistantMessage={assistantMsg}
          parts={{}}
          onFork={onFork}
        />,
      );

      fireEvent.click(screen.getByTestId('fork-btn'));
      const confirmBtn = document.querySelector('.confirm-btn.confirm')!;
      fireEvent.click(confirmBtn);

      expect(onFork).toHaveBeenCalledWith(userMsg.id);
    });

    it('does not call onFork when fork is cancelled', () => {
      const onFork = vi.fn();
      const userMsg = createMockUserMessage();
      const assistantMsg = createMockAssistantMessage();

      render(
        <MessageTurn
          userMessage={userMsg}
          assistantMessage={assistantMsg}
          parts={{}}
          onFork={onFork}
        />,
      );

      fireEvent.click(screen.getByTestId('fork-btn'));
      const cancelBtn = document.querySelector('.confirm-btn.cancel')!;
      fireEvent.click(cancelBtn);

      expect(onFork).not.toHaveBeenCalled();
    });

    it('does not render fork button for subtask turns', () => {
      const userMsg = createMockUserMessage();
      const subtaskPart = createMockTextPart('subtask content');
      subtaskPart.messageID = userMsg.id;
      subtaskPart.type = 'subtask' as never;

      render(
        <MessageTurn
          userMessage={userMsg}
          parts={{ [userMsg.id]: [subtaskPart] }}
          onFork={vi.fn()}
        />,
      );

      expect(screen.queryByTestId('fork-btn')).not.toBeInTheDocument();
    });
  });
});
