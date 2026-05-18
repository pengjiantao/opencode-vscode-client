/**
 * @file Unit tests for PartRenderer — dispatches to correct sub-renderer per part type.
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMockReasoningPart,
  createMockTextPart,
  createMockToolPart,
} from '../../test/mocks/sdk';
import { PartRenderer } from './PartRenderer';

describe('PartRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders text part', () => {
    const part = createMockTextPart('Hello, world!');
    render(<PartRenderer part={part} />);
    expect(screen.getByText('Hello, world!')).toBeInTheDocument();
  });

  it('renders tool part', () => {
    const part = createMockToolPart('bash');
    render(<PartRenderer part={part} />);
    expect(screen.getByText(/Tool: bash/)).toBeInTheDocument();
  });

  it('renders reasoning part', () => {
    const part = createMockReasoningPart('Let me think about this...');
    render(<PartRenderer part={part} />);
    expect(screen.getByText(/Thinking/)).toBeInTheDocument();
  });

  it('renders file part', () => {
    const part = {
      type: 'file' as const,
      id: 'part-1',
      sessionID: 'session-1',
      messageID: 'msg-1',
      mime: 'text/plain',
      url: 'file:///test.txt',
      filename: 'test.txt',
    };
    render(<PartRenderer part={part} />);
    expect(screen.getByText('test.txt')).toBeInTheDocument();
  });

  it('renders unknown part type', () => {
    const part = {
      type: 'unknown' as unknown as 'text',
      id: 'part-1',
      sessionID: 'session-1',
      messageID: 'msg-1',
    };
    render(<PartRenderer part={part as unknown as import('@opencode-ai/sdk').Part} />);
    expect(screen.getByText(/Unknown part type/)).toBeInTheDocument();
  });

  it('renders step-start part as null', () => {
    const part = {
      type: 'step-start' as const,
      id: 'part-step-start',
      sessionID: 'session-1',
      messageID: 'msg-1',
    };
    const { container } = render(
      <PartRenderer part={part as unknown as import('@opencode-ai/sdk').Part} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders step-finish part as null', () => {
    const part = {
      type: 'step-finish' as const,
      id: 'part-step-finish',
      sessionID: 'session-1',
      messageID: 'msg-1',
    };
    const { container } = render(
      <PartRenderer part={part as unknown as import('@opencode-ai/sdk').Part} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('suppresses streaming dot for user text parts', () => {
    const part = createMockTextPart('Hello user message text');
    part.time = { start: Date.now() };

    const { container } = render(<PartRenderer part={part} isAssistant={false} />);
    expect(container.querySelector('.streaming')).not.toBeInTheDocument();
  });

  it('shows streaming dot for assistant text parts', () => {
    const part = createMockTextPart('Hello assistant message text');
    part.time = { start: Date.now() };

    const { container } = render(<PartRenderer part={part} isAssistant={true} />);
    expect(container.querySelector('.streaming')).toBeInTheDocument();
  });

  it('renders markdown code block without native title on the copy button to support custom tooltips', () => {
    const part = createMockTextPart('```js\nconsole.log("hello");\n```');
    const { container } = render(<PartRenderer part={part} />);

    const copyBtn = container.querySelector('.copy-code-btn');
    expect(copyBtn).toBeInTheDocument();
    expect(copyBtn).not.toHaveAttribute('title');
    expect(copyBtn).toHaveAttribute('data-custom-title', 'Copy Code');
  });
});
