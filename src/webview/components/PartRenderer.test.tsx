/**
 * @file Unit tests for PartRenderer — dispatches to correct sub-renderer per part type.
 */

import { fireEvent, render, screen } from '@testing-library/react';
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

      // grep_search defaults to collapsed — expand it first
      fireEvent.click(container.querySelector('.tool-header')!);

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

    it('regression: glob tool without title still shows descriptive summary from input.pattern', () => {
      const part = createMockToolPart('glob');
      part.state = {
        status: 'completed',
        input: { pattern: '**/test/**/*' },
        output: 'No files found',
        title: '',
        time: { start: Date.now(), end: Date.now() + 100 },
        metadata: {},
      };
      render(<PartRenderer part={part} />);

      // Header must contain the pattern, not just "GLOB"
      expect(screen.getByText('GLOB - Search files matching "**/test/**/*"')).toBeInTheDocument();
    });

    it('regression: renders edit tool output as DiffPart when metadata contains diff', () => {
      const part = createMockToolPart('edit');
      part.state = {
        status: 'completed',
        input: { filePath: 'src/main.ts' },
        output: 'Success',
        title: 'Editing main.ts',
        time: { start: Date.now(), end: Date.now() + 1000 },
        metadata: {
          diff: '--- a/src/main.ts\n+++ b/src/main.ts\n@@ -1,2 +1,3 @@\n-const old = 1;\n+const newText = 1;\n+const extra = 2;',
        },
      };

      const { container } = render(<PartRenderer part={part} />);

      // Should render Diff table directly, omitting "Diff" section label and the input text
      expect(screen.queryByText('Diff')).not.toBeInTheDocument();
      expect(screen.queryByText(/FILEPATH/i)).not.toBeInTheDocument();
      expect(container.querySelector('.diff-table')).toBeInTheDocument();
      expect(screen.getByText('const old = 1;')).toBeInTheDocument();
      expect(screen.getByText('const newText = 1;')).toBeInTheDocument();
      expect(screen.getByText('const extra = 2;')).toBeInTheDocument();
    });

    it('regression: renders apply_patch output as DiffPart for each modified file', () => {
      const part = createMockToolPart('apply_patch');
      part.state = {
        status: 'completed',
        input: {},
        output: 'Success',
        title: 'Applying patch',
        time: { start: Date.now(), end: Date.now() + 1000 },
        metadata: {
          files: [
            {
              filePath: 'src/helper.ts',
              type: 'modify',
              patch:
                '--- a/src/helper.ts\n+++ b/src/helper.ts\n@@ -5,2 +5,2 @@\n-oldHelper\n+newHelper',
            },
            {
              filePath: 'src/deleted.ts',
              type: 'delete',
              deletions: 10,
            },
          ],
        },
      };

      const { container } = render(<PartRenderer part={part} />);

      // Verify "Applied Patch" header label is NOT generated, but file-specific headers are
      expect(screen.queryByText('Applied Patch')).not.toBeInTheDocument();
      expect(screen.getByText('Patched src/helper.ts')).toBeInTheDocument();
      expect(screen.getByText('Deleted src/deleted.ts')).toBeInTheDocument();

      // Verify helper.ts diff table is rendered
      expect(container.querySelector('.diff-table')).toBeInTheDocument();
      expect(screen.getByText('oldHelper')).toBeInTheDocument();
      expect(screen.getByText('newHelper')).toBeInTheDocument();

      // Verify deleted.ts lines deleted summary is rendered
      expect(screen.getByText('-10 lines')).toBeInTheDocument();
    });

    it('regression: renders write tool output with a synthetic diff, hides input/label, and defaults to expanded', () => {
      const part = createMockToolPart('write');
      part.state = {
        status: 'completed',
        input: {
          TargetFile: 'src/new-file.js',
          content: 'console.log("hello world");\nconst x = 5;',
        },
        output: 'Success',
        title: 'Writing new-file.js',
        time: { start: Date.now(), end: Date.now() + 1000 },
        metadata: {},
      };

      const { container } = render(<PartRenderer part={part} />);

      // Verify the element is default expanded (class list contains expanded, not collapsed)
      const toolPartEl = container.querySelector('.tool-part');
      expect(toolPartEl).toHaveClass('expanded');
      expect(toolPartEl).not.toHaveClass('collapsed');

      // Verify the synthetic diff table is rendered with added lines
      expect(container.querySelector('.diff-table')).toBeInTheDocument();
      expect(screen.getByText('console.log("hello world");')).toBeInTheDocument();
      expect(screen.getByText('const x = 5;')).toBeInTheDocument();

      // Verify labels like "Diff", "Output" or input contents are not visible
      expect(screen.queryByText('Diff')).not.toBeInTheDocument();
      expect(screen.queryByText('Output')).not.toBeInTheDocument();
      expect(screen.queryByText(/TARGETFILE/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/CONTENT/i)).not.toBeInTheDocument();
    });

    it('regression: renders bash tool streaming/real-time output, defaults to expanded, shows header command, hides input block/labels, and header is strictly BASH', () => {
      const part = createMockToolPart('bash');
      part.state = {
        status: 'running',
        title: 'List files',
        input: {
          command: 'ls -la',
        },
        time: { start: Date.now() },
        metadata: {
          output: 'total 0\ndrwxr-xr-x 1 user staff 0 May 24 10:00 .',
        },
      };

      const { container } = render(<PartRenderer part={part} />);

      // 1. Collapsible header shows BASH with description
      expect(screen.getByText('BASH - List files')).toBeInTheDocument();

      // 2. Default expanded
      const toolPartEl = container.querySelector('.tool-part');
      expect(toolPartEl).toHaveClass('expanded');
      expect(toolPartEl).not.toHaveClass('collapsed');

      // 3. Header command is shown in output header
      const cmdSpan = container.querySelector('.bash-output-command');
      expect(cmdSpan).toBeInTheDocument();
      expect(cmdSpan?.textContent).toBe('ls -la');
      expect(cmdSpan?.getAttribute('data-custom-title')).toBe('ls -la');

      // Verify thinking/executing spinner icon is displayed in the running state
      expect(container.querySelector('.codicon-sync.codicon-modifier-spin')).toBeInTheDocument();

      // 4. Output contains output text from metadata.output
      expect(screen.getByText(/total 0/)).toBeInTheDocument();

      // 5. Hide labels and input blocks (redundant inputs/labels are omitted)
      expect(screen.queryByText('Output')).not.toBeInTheDocument();
      expect(screen.queryByText(/COMMAND/i)).not.toBeInTheDocument();
    });

    it('regression: falls back to state.output when metadata.output is not available for completed bash tool', () => {
      const part = createMockToolPart('run_command');
      part.state = {
        status: 'completed',
        input: {
          command: 'echo hello',
        },
        title: 'echo hello',
        output: 'hello',
        time: { start: Date.now(), end: Date.now() + 10 },
        metadata: {},
      };

      const { container } = render(<PartRenderer part={part} />);

      expect(screen.getByText('BASH - echo hello')).toBeInTheDocument();
      expect(screen.getByText('hello')).toBeInTheDocument();
      expect(screen.queryByText('Output')).not.toBeInTheDocument();

      // Verify thinking spinner icon is NOT displayed in completed state
      expect(container.querySelector('.codicon-sync')).not.toBeInTheDocument();
    });

    it('regression: returns null from BashOutput when output is empty/undefined', () => {
      const part = createMockToolPart('bash');
      part.state = {
        status: 'running',
        input: {
          command: 'ls',
        },
        time: { start: Date.now() },
        metadata: {
          output: '', // empty output
        },
      };

      const { container } = render(<PartRenderer part={part} />);

      // Output component is not rendered, so tool-bash-output container shouldn't be in the document
      expect(container.querySelector('.tool-bash-output')).not.toBeInTheDocument();
    });

    it('regression: falls back to state.title when input.command is missing for bash tool', () => {
      const part = createMockToolPart('bash');
      part.state = {
        status: 'running',
        input: {}, // missing command
        title: 'fallback command execution',
        time: { start: Date.now() },
        metadata: {
          output: 'some output',
        },
      };

      const { container } = render(<PartRenderer part={part} />);

      const cmdSpan = container.querySelector('.bash-output-command');
      expect(cmdSpan).toBeInTheDocument();
      expect(cmdSpan?.textContent).toBe('fallback command execution');
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
