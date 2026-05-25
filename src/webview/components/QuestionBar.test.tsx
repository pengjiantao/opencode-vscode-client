/**
 * @file Unit tests for QuestionBar — renders question forms, handles page navigation,
 * handles radio/checkbox options, custom textarea inputs, and replies/dismissals.
 */

import type { QuestionRequest } from '@opencode-ai/sdk/v2/client';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionStore } from '../store/sessionStore';
import { QuestionBar } from './QuestionBar';

describe('QuestionBar', () => {
  const mockOnReply = vi.fn();
  const mockOnReject = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.setState({
      pendingQuestions: [],
    });
  });

  it('renders nothing when there are no pending questions', () => {
    const { container } = render(
      <QuestionBar sessionID="session-1" onReply={mockOnReply} onReject={mockOnReject} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('filters pending questions by session ID', () => {
    const q1: QuestionRequest = {
      id: 'q-1',
      sessionID: 'session-1',
      questions: [
        {
          header: 'Q1 Header',
          question: 'Is this session 1?',
          options: [{ label: 'Yes', description: '' }],
        },
      ],
    };
    const q2: QuestionRequest = {
      id: 'q-2',
      sessionID: 'session-2',
      questions: [
        {
          header: 'Q2 Header',
          question: 'Is this session 2?',
          options: [{ label: 'No', description: '' }],
        },
      ],
    };

    useSessionStore.setState({
      pendingQuestions: [q1, q2],
    });

    render(<QuestionBar sessionID="session-1" onReply={mockOnReply} onReject={mockOnReject} />);

    expect(screen.getByText('Is this session 1?')).toBeInTheDocument();
    expect(screen.queryByText('Is this session 2?')).toBeNull();
  });

  it('handles auto-submit for single question, single choice without custom input (skip confirm)', () => {
    const req: QuestionRequest = {
      id: 'q-1',
      sessionID: 'session-1',
      questions: [
        {
          header: 'Simple question',
          question: 'Pick one',
          options: [
            { label: 'Option A', description: 'Desc A' },
            { label: 'Option B', description: 'Desc B' },
          ],
        },
      ],
    };

    useSessionStore.setState({
      pendingQuestions: [req],
    });

    render(<QuestionBar sessionID="session-1" onReply={mockOnReply} onReject={mockOnReject} />);

    const optionA = screen.getByText('Option A');
    fireEvent.click(optionA);

    expect(mockOnReply).toHaveBeenCalledWith('q-1', [['Option A']]);
    expect(useSessionStore.getState().pendingQuestions).toEqual([]);
  });

  it('requires explicit submit when there is a custom answer option', () => {
    const req: QuestionRequest = {
      id: 'q-1',
      sessionID: 'session-1',
      questions: [
        {
          header: 'Question with custom',
          question: 'Pick one or write own',
          options: [{ label: 'Option A', description: '' }],
          custom: true,
        },
      ],
    };

    useSessionStore.setState({
      pendingQuestions: [req],
    });

    render(<QuestionBar sessionID="session-1" onReply={mockOnReply} onReject={mockOnReject} />);

    const optionA = screen.getByText('Option A');
    fireEvent.click(optionA);

    // Should not have auto-submitted because custom: true
    expect(mockOnReply).not.toHaveBeenCalled();

    const submitBtn = screen.getByRole('button', { name: 'Submit' });
    fireEvent.click(submitBtn);

    expect(mockOnReply).toHaveBeenCalledWith('q-1', [['Option A']]);
  });

  it('renders checkbox and allows multi-selection', () => {
    const req: QuestionRequest = {
      id: 'q-1',
      sessionID: 'session-1',
      questions: [
        {
          header: 'Multiple choice',
          question: 'Pick many',
          options: [
            { label: 'Opt 1', description: '' },
            { label: 'Opt 2', description: '' },
          ],
          multiple: true,
        },
      ],
    };

    useSessionStore.setState({
      pendingQuestions: [req],
    });

    render(<QuestionBar sessionID="session-1" onReply={mockOnReply} onReject={mockOnReject} />);

    const check1 = screen.getByText('Opt 1');
    const check2 = screen.getByText('Opt 2');

    fireEvent.click(check1);
    fireEvent.click(check2);

    const submitBtn = screen.getByRole('button', { name: 'Submit' });
    fireEvent.click(submitBtn);

    expect(mockOnReply).toHaveBeenCalledWith('q-1', [['Opt 1', 'Opt 2']]);
  });

  it('shows custom textarea when "Type your own answer" option is toggled', () => {
    const req: QuestionRequest = {
      id: 'q-1',
      sessionID: 'session-1',
      questions: [
        {
          header: 'Custom check',
          question: 'Choose',
          options: [{ label: 'Predefined', description: '' }],
          custom: true,
        },
      ],
    };

    useSessionStore.setState({
      pendingQuestions: [req],
    });

    render(<QuestionBar sessionID="session-1" onReply={mockOnReply} onReject={mockOnReject} />);

    expect(screen.queryByPlaceholderText('Enter your custom answer here...')).toBeNull();

    const customCheckbox = screen.getByText('Type your own answer');
    fireEvent.click(customCheckbox);

    const textarea = screen.getByPlaceholderText('Enter your custom answer here...');
    expect(textarea).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: 'My custom text' } });

    const submitBtn = screen.getByRole('button', { name: 'Submit' });
    fireEvent.click(submitBtn);

    expect(mockOnReply).toHaveBeenCalledWith('q-1', [['My custom text']]);
  });

  it('displays textarea directly if there are no predefined options and custom is true', () => {
    const req: QuestionRequest = {
      id: 'q-1',
      sessionID: 'session-1',
      questions: [
        {
          header: 'Input direct',
          question: 'Write something',
          options: [],
          custom: true,
        },
      ],
    };

    useSessionStore.setState({
      pendingQuestions: [req],
    });

    render(<QuestionBar sessionID="session-1" onReply={mockOnReply} onReject={mockOnReject} />);

    const textarea = screen.getByPlaceholderText('Type your answer...');
    expect(textarea).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: 'Direct input value' } });

    const submitBtn = screen.getByRole('button', { name: 'Submit' });
    fireEvent.click(submitBtn);

    expect(mockOnReply).toHaveBeenCalledWith('q-1', [['Direct input value']]);
  });

  it('supports pagination with Back/Next buttons for multi-question requests', () => {
    const req: QuestionRequest = {
      id: 'q-1',
      sessionID: 'session-1',
      questions: [
        {
          header: 'Q1',
          question: 'First question',
          options: [{ label: 'A', description: '' }],
        },
        {
          header: 'Q2',
          question: 'Second question',
          options: [{ label: 'B', description: '' }],
        },
      ],
    };

    useSessionStore.setState({
      pendingQuestions: [req],
    });

    render(<QuestionBar sessionID="session-1" onReply={mockOnReply} onReject={mockOnReject} />);

    expect(screen.getByText('First question')).toBeInTheDocument();
    expect(screen.queryByText('Second question')).toBeNull();

    // Click A (this is page 1, so it shouldn't auto-submit since there are multiple pages)
    fireEvent.click(screen.getByText('A'));
    expect(mockOnReply).not.toHaveBeenCalled();

    // Next button
    const nextBtn = screen.getByRole('button', { name: 'Next' });
    fireEvent.click(nextBtn);

    expect(screen.getByText('Second question')).toBeInTheDocument();
    expect(screen.queryByText('First question')).toBeNull();

    // Back button
    const backBtn = screen.getByRole('button', { name: 'Back' });
    fireEvent.click(backBtn);

    expect(screen.getByText('First question')).toBeInTheDocument();
    expect(screen.queryByText('Second question')).toBeNull();

    // Go next again
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByText('B'));

    // Submit button (since we are on the last page)
    const submitBtn = screen.getByRole('button', { name: 'Submit' });
    fireEvent.click(submitBtn);

    expect(mockOnReply).toHaveBeenCalledWith('q-1', [['A'], ['B']]);
  });

  it('triggers onReject and cleans up store when dismissed', () => {
    const req: QuestionRequest = {
      id: 'q-1',
      sessionID: 'session-1',
      questions: [
        {
          header: 'Q',
          question: 'Answer?',
          options: [{ label: 'Yes', description: '' }],
        },
      ],
    };

    useSessionStore.setState({
      pendingQuestions: [req],
    });

    render(<QuestionBar sessionID="session-1" onReply={mockOnReply} onReject={mockOnReject} />);

    const dismissBtn = screen.getByRole('button', { name: 'Dismiss' });
    fireEvent.click(dismissBtn);

    expect(mockOnReject).toHaveBeenCalledWith('q-1');
    expect(useSessionStore.getState().pendingQuestions).toEqual([]);
  });

  it('prepends sub-agent title to header if subagentTitle is present', () => {
    const req = {
      id: 'q-1',
      sessionID: 'session-1',
      questions: [
        {
          header: 'Confirm action',
          question: 'Do you want to proceed?',
          options: [{ label: 'Yes', description: '' }],
        },
      ],
      subagentTitle: 'Run tests (@build subagent)',
    } as unknown as QuestionRequest;

    useSessionStore.setState({
      pendingQuestions: [req],
    });

    render(<QuestionBar sessionID="session-1" onReply={mockOnReply} onReject={mockOnReject} />);

    expect(
      screen.getByText('[Sub-agent: Run tests (@build subagent)] Confirm action'),
    ).toBeInTheDocument();
  });
});
