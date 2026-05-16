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
    expect(screen.getByText('bash')).toBeInTheDocument();
  });

  it('renders reasoning part', () => {
    const part = createMockReasoningPart('Let me think about this...');
    render(<PartRenderer part={part} />);
    expect(screen.getByText('Thinking')).toBeInTheDocument();
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
});
