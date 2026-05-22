/**
 * @file Unit tests for PartRenderer — dispatches to correct sub-renderer per part type.
 */

import { render, screen } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
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
    expect(screen.getByText(/bash/i)).toBeInTheDocument();
  });

  it('renders tool part with tool-specific icon and no Tool prefix', () => {
    const part = createMockToolPart('bash');
    const { container } = render(<PartRenderer part={part} />);
    // Check that we render the terminal icon for bash
    const iconElement = container.querySelector('.codicon-terminal');
    expect(iconElement).toBeInTheDocument();
    // Check that the summary text doesn't have the "Tool: " prefix
    expect(screen.getByText(/bash/i)).toBeInTheDocument();
    expect(screen.queryByText(/Tool: bash/i)).not.toBeInTheDocument();
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
    expect(chipElement?.getAttribute('data-custom-title')).toContain('hello');
  });

  it('renders unknown part type as null', () => {
    const part = {
      type: 'unknown' as unknown as 'text',
      id: 'part-1',
      sessionID: 'session-1',
      messageID: 'msg-1',
    };
    const { container } = render(
      <PartRenderer part={part as unknown as import('@opencode-ai/sdk/v2/client').Part} />,
    );
    expect(container.firstChild).toBeNull();
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

  it('regression: layout.css does not define a streaming dot or styling for .streaming', () => {
    const cssPath = path.resolve(__dirname, '../styles/layout.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // Ensure .streaming classes and pulse keyframes are not defined
    expect(cssContent).not.toContain('.streaming');
    expect(cssContent).not.toContain('pulse');
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

  it('regression: renders code-selection part as code-selection chip in chat area', () => {
    const part = {
      type: 'file' as const,
      id: 'part-code',
      sessionID: 'session-1',
      messageID: 'msg-1',
      mime: 'text/plain',
      url: 'file:///src/main.ts',
      filename: 'main.ts [1-10]',
      source: {
        type: 'file' as const,
        path: 'src/main.ts',
        text: {
          value: 'const a = 1;',
          start: 1,
          end: 10,
        },
      },
    };
    const { container } = render(<PartRenderer part={part} />);
    const chipElement = container.querySelector('.opencode-chip.code-selection-chip');
    expect(chipElement).toBeInTheDocument();
    expect(screen.getByText('main.ts [1-10]')).toBeInTheDocument();
  });

  it('regression: renders terminal part as terminal chip in chat area', () => {
    const part = {
      type: 'file' as const,
      id: 'part-terminal',
      sessionID: 'session-1',
      messageID: 'msg-1',
      mime: 'text/plain',
      url: 'data:text/plain;base64,ZXJyb3I=',
      filename: 'terminal [3 lines]',
      source: {
        type: 'file' as const,
        path: 'terminal-part-terminal',
        text: {
          value: 'error',
          start: 1,
          end: 3,
        },
      },
    };
    const { container } = render(<PartRenderer part={part} />);
    const chipElement = container.querySelector('.opencode-chip.terminal-chip');
    expect(chipElement).toBeInTheDocument();
    expect(screen.getByText('terminal [3 lines]')).toBeInTheDocument();
  });

  it('regression: renders directory part as file chip with folder icon and no line range', () => {
    const part = {
      type: 'file' as const,
      id: 'part-dir',
      sessionID: 'session-1',
      messageID: 'msg-1',
      mime: 'directory',
      url: 'file:///src/memory',
      filename: 'memory',
      source: {
        type: 'file' as const,
        path: 'src/memory',
      },
    } as unknown as import('@opencode-ai/sdk/v2/client').Part;
    const { container } = render(<PartRenderer part={part} />);
    const chipElement = container.querySelector('.opencode-chip');
    expect(chipElement).toBeInTheDocument();
    expect(chipElement).toHaveClass('file-chip');
    expect(screen.getByText('memory')).toBeInTheDocument();
    expect(screen.queryByText('memory [1-1]')).not.toBeInTheDocument();
    const iconElement = container.querySelector('.codicon-folder');
    expect(iconElement).toBeInTheDocument();
  });

  it('regression: renders application/x-directory part with folder icon and no line range', () => {
    const part = {
      type: 'file' as const,
      id: 'part-dir-app',
      sessionID: 'session-1',
      messageID: 'msg-1',
      mime: 'application/x-directory',
      url: 'file:///src/memory',
      filename: 'memory',
      source: {
        type: 'file' as const,
        path: 'src/memory',
      },
    } as unknown as import('@opencode-ai/sdk/v2/client').Part;
    const { container } = render(<PartRenderer part={part} />);
    const chipElement = container.querySelector('.opencode-chip');
    expect(chipElement).toBeInTheDocument();
    expect(chipElement).toHaveClass('file-chip');
    expect(screen.getByText('memory')).toBeInTheDocument();
    expect(screen.queryByText('memory [1-1]')).not.toBeInTheDocument();
    const iconElement = container.querySelector('.codicon-folder');
    expect(iconElement).toBeInTheDocument();
  });

  it('regression: renders sourceless directory part correctly with folder icon', () => {
    const part = {
      type: 'file' as const,
      id: 'part-dir-sourceless',
      sessionID: 'session-1',
      messageID: 'msg-1',
      mime: 'application/x-directory',
      url: 'file:///src/memory',
      filename: 'memory',
    } as unknown as import('@opencode-ai/sdk/v2/client').Part;
    const { container } = render(<PartRenderer part={part} />);
    const chipElement = container.querySelector('.opencode-chip');
    expect(chipElement).toBeInTheDocument();
    expect(chipElement).toHaveClass('file-chip');
    expect(screen.getByText('memory')).toBeInTheDocument();
    expect(screen.queryByText('memory [1-1]')).not.toBeInTheDocument();
    const iconElement = container.querySelector('.codicon-folder');
    expect(iconElement).toBeInTheDocument();
  });

  it('regression: renders whole file parts without line range and with file icon when source is omitted', () => {
    const part = {
      type: 'file' as const,
      id: 'part-file-sourceless',
      sessionID: 'session-1',
      messageID: 'msg-1',
      mime: 'text/plain',
      url: 'file:///src/main.py',
      filename: 'main.py',
    } as unknown as import('@opencode-ai/sdk/v2/client').Part;
    const { container } = render(<PartRenderer part={part} />);
    const chipElement = container.querySelector('.opencode-chip');
    expect(chipElement).toBeInTheDocument();
    expect(chipElement).toHaveClass('file-chip');
    expect(screen.getByText('main.py')).toBeInTheDocument();
    expect(screen.queryByText('main.py [1-1]')).not.toBeInTheDocument();
    const iconElement = container.querySelector('.codicon-file-text');
    expect(iconElement).toBeInTheDocument();
  });

  it('regression: renders whole file part with source text but no line range as file chip without line range suffix', () => {
    const part = {
      type: 'file' as const,
      id: 'part-file-with-text-sourceless-range',
      sessionID: 'session-1',
      messageID: 'msg-1',
      mime: 'text/plain',
      url: 'file:///src/main.py',
      filename: 'main.py',
      source: {
        type: 'file' as const,
        path: 'src/main.py',
        text: {
          value: 'file contents',
        },
      },
    } as unknown as import('@opencode-ai/sdk/v2/client').Part;
    const { container } = render(<PartRenderer part={part} />);
    const chipElement = container.querySelector('.opencode-chip');
    expect(chipElement).toBeInTheDocument();
    expect(chipElement).toHaveClass('file-chip');
    expect(screen.getByText('main.py')).toBeInTheDocument();
    expect(screen.queryByText('main.py [1-1]')).not.toBeInTheDocument();
    const iconElement = container.querySelector('.codicon-file-text');
    expect(iconElement).toBeInTheDocument();
  });

  describe('ToolPart display optimizations', () => {
    it('renders tool name in UPPERCASE and does not append running/failed in header', () => {
      const part = createMockToolPart('write_to_file');
      part.state = {
        status: 'running',
        input: {},
        title: 'Updating code',
        time: { start: Date.now() },
      };
      render(<PartRenderer part={part} />);

      // Name should be uppercase and contain the title, but no "(running...)"
      expect(screen.getByText('WRITE_TO_FILE - Updating code')).toBeInTheDocument();
      expect(screen.queryByText(/running/)).not.toBeInTheDocument();
    });

    it('expands JSON input to show as UPPERCASE_KEY value and omits INPUT character header', () => {
      const part = createMockToolPart('grep_search');
      part.state.input = {
        filePath: '/workspace/src',
        query: 'search-query',
        matchCount: 10,
      };

      const { container } = render(<PartRenderer part={part} />);

      // INPUT header should be removed
      expect(screen.queryByText('Input')).not.toBeInTheDocument();
      expect(screen.queryByText('INPUT')).not.toBeInTheDocument();

      // JSON should be expanded to uppercase keys followed by spaces and values
      const preElement = container.querySelector('.tool-input pre');
      expect(preElement).toBeInTheDocument();
      expect(preElement?.textContent).toContain('FILEPATH /workspace/src');
      expect(preElement?.textContent).toContain('QUERY search-query');
      expect(preElement?.textContent).toContain('MATCHCOUNT 10');
    });
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
