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
import { getToolIcon } from './parts/ToolPart';

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
    expect(screen.getByText(/bash/)).toBeInTheDocument();
  });

  it('renders tool part with tool-specific icon and no Tool prefix', () => {
    const part = createMockToolPart('bash');
    const { container } = render(<PartRenderer part={part} />);
    // Check that we render the terminal icon for bash
    const iconElement = container.querySelector('.codicon-terminal');
    expect(iconElement).toBeInTheDocument();
    // Check that the summary text doesn't have the "Tool: " prefix
    expect(screen.getByText(/bash/)).toBeInTheDocument();
    expect(screen.queryByText(/Tool: bash/)).not.toBeInTheDocument();
  });

  it('renders reasoning part', () => {
    const part = createMockReasoningPart('Let me think about this...');
    render(<PartRenderer part={part} />);
    expect(screen.getByText(/Thinking/)).toBeInTheDocument();
  });

  it('renders reasoning part with dynamic loading and completed icons', () => {
    // 1. Check thinking/loading state
    const partRunning = createMockReasoningPart('Let me think...');
    partRunning.time = { start: Date.now() }; // end is undefined
    const { container: containerRunning } = render(<PartRenderer part={partRunning} />);
    expect(containerRunning.querySelector('.codicon-sync')).toBeInTheDocument();

    // 2. Check completed state
    const partCompleted = createMockReasoningPart('Done thinking.');
    partCompleted.time = { start: Date.now(), end: Date.now() + 1000 };
    const { container: containerCompleted } = render(<PartRenderer part={partCompleted} />);
    expect(containerCompleted.querySelector('.codicon-lightbulb')).toBeInTheDocument();
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

  it('renders file part with source path passed to Chip', () => {
    const part = {
      type: 'file' as const,
      id: 'part-1',
      sessionID: 'session-1',
      messageID: 'msg-1',
      mime: 'text/plain',
      url: 'data:text/plain;base64,aGVsbG8=',
      filename: 'test_source.txt',
      source: {
        type: 'file' as const,
        path: 'src/test_source.txt',
        text: {
          value: 'hello',
          start: 1,
          end: 1,
        },
      },
    };
    const { container } = render(<PartRenderer part={part} />);
    const chipElement = container.querySelector('.opencode-chip');
    expect(chipElement).toBeInTheDocument();
    expect(chipElement?.getAttribute('data-custom-title')).toContain('src/test_source.txt');
  });

  it('renders unknown part type', () => {
    const part = {
      type: 'unknown' as unknown as 'text',
      id: 'part-1',
      sessionID: 'session-1',
      messageID: 'msg-1',
    };
    render(<PartRenderer part={part as unknown as import('@opencode-ai/sdk/v2/client').Part} />);
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
      <PartRenderer part={part as unknown as import('@opencode-ai/sdk/v2/client').Part} />,
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
      <PartRenderer part={part as unknown as import('@opencode-ai/sdk/v2/client').Part} />,
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

  it('renders markdown code block without any leading whitespace in the first line of code', () => {
    const part = createMockTextPart('```js\nconsole.log("hello");\n```');
    const { container } = render(<PartRenderer part={part} />);

    const codeElement = container.querySelector('pre.code-block code');
    expect(codeElement).toBeInTheDocument();
    expect(codeElement?.textContent?.startsWith(' ')).toBe(false);
    expect(codeElement?.textContent?.startsWith('\n')).toBe(false);
  });

  describe('getToolIcon', () => {
    it('maps tools to correct icons in a case-insensitive manner', () => {
      expect(getToolIcon('BASH')).toBe('$(terminal)');
      expect(getToolIcon('run_command')).toBe('$(terminal)');
      expect(getToolIcon('grep_search')).toBe('$(search)');
      expect(getToolIcon('list_dir')).toBe('$(folder)');
      expect(getToolIcon('write_to_file')).toBe('$(edit)');
      expect(getToolIcon('read_file')).toBe('$(file-code)');
      expect(getToolIcon('browser_search')).toBe('$(browser)');
      expect(getToolIcon('web_search')).toBe('$(browser)');
    });

    it('falls back to toolbox icon for unknown tools', () => {
      expect(getToolIcon('unknown_custom_tool')).toBe('$(tools)');
      expect(getToolIcon('')).toBe('$(tools)');
    });
  });
});
