import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockAssistantMessage, createMockUserMessage } from '../../test/mocks/sdk';
import { MessageTurn } from './MessageTurn';

describe('MessageTurn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders user message', () => {
    const userMsg = createMockUserMessage();

    render(<MessageTurn userMessage={userMsg} parts={{}} />);

    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('renders assistant message when provided', () => {
    const userMsg = createMockUserMessage();
    const assistantMsg = createMockAssistantMessage();

    render(<MessageTurn userMessage={userMsg} assistantMessage={assistantMsg} parts={{}} />);

    expect(screen.getByText('Assistant')).toBeInTheDocument();
  });

  it('does not render assistant section when not provided', () => {
    const userMsg = createMockUserMessage();

    render(<MessageTurn userMessage={userMsg} parts={{}} />);

    expect(screen.queryByText('Assistant')).not.toBeInTheDocument();
  });
});
