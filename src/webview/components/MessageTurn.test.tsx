import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMockAssistantMessage,
  createMockTextPart,
  createMockUserMessage,
} from '../../test/mocks/sdk';
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

  it('renders user message parts using PartRenderer instead of JSON.stringify', () => {
    const userMsg = createMockUserMessage();
    const textPart = createMockTextPart('Hello user message part!');
    textPart.messageID = userMsg.id;

    render(<MessageTurn userMessage={userMsg} parts={{ [userMsg.id]: [textPart] }} />);

    expect(screen.getByText('Hello user message part!')).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(userMsg.id))).not.toBeInTheDocument();
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
