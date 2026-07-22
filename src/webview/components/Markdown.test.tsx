/**
 * @file Unit and regression tests for Markdown component — verifying tables, lists, and headings.
 */

import type { Part } from '@opencode-ai/sdk/v2/client';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getRegisteredTooltipContent } from '../utils/tooltipContentRegistry';
import { Markdown } from './Markdown';

describe('Markdown Component', () => {
  it('renders bold, italic, and inline code correctly', () => {
    render(<Markdown text="This is **bold**, *italic*, and `code` text." />);
    expect(screen.getByText('bold').tagName).toBe('STRONG');
    expect(screen.getByText('italic').tagName).toBe('EM');
    expect(screen.getByText('code').tagName).toBe('CODE');
  });

  it('renders headers correctly', () => {
    const { container } = render(
      <Markdown text={['# Header 1', '## Header 2', '### Header 3'].join('\n')} />,
    );
    expect(container.querySelector('h1')?.textContent).toBe('Header 1');
    expect(container.querySelector('h2')?.textContent).toBe('Header 2');
    expect(container.querySelector('h3')?.textContent).toBe('Header 3');
  });

  it('renders lists correctly', () => {
    const { container } = render(
      <Markdown text={['- Item 1', '- Item 2', '1. First', '2. Second'].join('\n')} />,
    );
    expect(container.querySelector('ul')).toBeInTheDocument();
    expect(container.querySelector('ol')).toBeInTheDocument();
    expect(screen.getByText('Item 1').tagName).toBe('LI');
    expect(screen.getByText('First').tagName).toBe('LI');
  });

  it('renders table elements correctly with headers and body rows', () => {
    const markdownTable = [
      '| Header A | Header B |',
      '|----------|----------|',
      '| Cell A1  | Cell B1  |',
      '| Cell A2  | Cell B2  |',
    ].join('\n');

    const { container } = render(<Markdown text={markdownTable} />);

    expect(container.querySelector('.markdown-table-wrapper')).toBeInTheDocument();
    expect(container.querySelector('table')).toHaveClass('markdown-table');
    expect(container.querySelectorAll('th')).toHaveLength(2);
    expect(container.querySelectorAll('td')).toHaveLength(4);

    expect(screen.getByText('Header A').tagName).toBe('TH');
    expect(screen.getByText('Cell B1').tagName).toBe('TD');
  });

  it('applies column alignments correctly based on GFM separator colons', () => {
    const markdownTable = [
      '| Left | Center | Right | Default |',
      '|:---|:---:|---:|---|',
      '| L | C | R | D |',
    ].join('\n');

    const { container } = render(<Markdown text={markdownTable} />);

    const headers = container.querySelectorAll('th');
    const cells = container.querySelectorAll('td');

    // Headers alignments
    expect(headers[0].style.textAlign).toBe('left');
    expect(headers[1].style.textAlign).toBe('center');
    expect(headers[2].style.textAlign).toBe('right');
    expect(headers[3].style.textAlign).toBe('');

    // Body cells alignments
    expect(cells[0].style.textAlign).toBe('left');
    expect(cells[1].style.textAlign).toBe('center');
    expect(cells[2].style.textAlign).toBe('right');
    expect(cells[3].style.textAlign).toBe('');
  });

  it('handles escaped pipes within cells correctly', () => {
    const markdownTable = [
      '| Commands | Description |',
      '|---|---|',
      '| `grep \\| search` | Searching with grep pipe |',
    ].join('\n');

    const { container } = render(<Markdown text={markdownTable} />);

    // Columns should be exactly 2, escaping should prevent it from splitting into 3 cells
    expect(container.querySelectorAll('th')).toHaveLength(2);
    const cells = container.querySelectorAll('td');
    expect(cells).toHaveLength(2);

    expect(cells[0].querySelector('code')?.textContent).toBe('grep | search');
  });

  it('flushes tables when encountering headings or lists', () => {
    const markdownTable = [
      '| Header |',
      '|---|',
      '| Cell |',
      '',
      '# Heading Flusher',
      '- List Flusher',
    ].join('\n');

    const { container } = render(<Markdown text={markdownTable} />);

    // The table, heading, and list should all coexist cleanly
    expect(container.querySelector('table')).toBeInTheDocument();
    expect(container.querySelector('h1')?.textContent).toBe('Heading Flusher');
    expect(container.querySelector('ul')).toBeInTheDocument();
  });

  it('handles unescaped pipe characters inside backtick inline code cells correctly', () => {
    const markdownTable = [
      '| 维度 | OpenCode SDK | Gemini CLI A2A |',
      '|---|---|---|',
      '| **工具输出** | `tool.success` 含 `content: [{type:"text"|"file",...}]` | `tool-call-update` |',
    ].join('\n');

    const { container } = render(<Markdown text={markdownTable} />);

    // Columns should be exactly 3, not split into 4 columns by the internal pipe in backticks
    expect(container.querySelectorAll('th')).toHaveLength(3);
    const cells = container.querySelectorAll('td');
    expect(cells).toHaveLength(3);

    // Check text contents
    expect(cells[0].textContent).toContain('工具输出');
    expect(cells[1].textContent).toContain('tool.success');
    expect(cells[1].textContent).toContain('content: [{type:"text"|"file",...}]');
    expect(cells[2].textContent).toBe('tool-call-update');
  });

  it('handles double and multiple backtick code spans within cells correctly', () => {
    const markdownTable = [
      '| Header |',
      '|---|',
      '| ``code | span`` |',
      '| ```triple | pipe``` |',
    ].join('\n');

    const { container } = render(<Markdown text={markdownTable} />);

    // Verified: should not split into multiple cells on the inner pipe
    expect(container.querySelectorAll('th')).toHaveLength(1);
    const cells = container.querySelectorAll('td');
    expect(cells).toHaveLength(2);
    expect(cells[0].textContent).toBe('code | span');
    expect(cells[1].textContent).toBe('triple | pipe');
  });

  it('handles escaped pipes at the end of a row correctly', () => {
    const markdownTable = ['| Header |', '|---|', '| cell \\|'].join('\n');

    const { container } = render(<Markdown text={markdownTable} />);

    const cells = container.querySelectorAll('td');
    expect(cells).toHaveLength(1);
    expect(cells[0].textContent).toBe('cell |');
  });

  it('renders empty tables without rendering an empty tbody node', () => {
    const markdownTable = ['| Header |', '|---|'].join('\n');

    const { container } = render(<Markdown text={markdownTable} />);

    expect(container.querySelector('table')).toBeInTheDocument();
    expect(container.querySelector('th')).toBeInTheDocument();
    expect(container.querySelector('tbody')).not.toBeInTheDocument();
  });

  it('handles empty cells correctly', () => {
    const markdownTable = ['| A | B |', '|---|---|', '| | Cell |', '| Cell | |', '| ||'].join('\n');

    const { container } = render(<Markdown text={markdownTable} />);

    expect(container.querySelectorAll('th')).toHaveLength(2);
    const cells = container.querySelectorAll('td');
    expect(cells).toHaveLength(6);
    expect(cells[0].textContent).toBe('');
    expect(cells[1].textContent).toBe('Cell');
    expect(cells[2].textContent).toBe('Cell');
    expect(cells[3].textContent).toBe('');
    expect(cells[4].textContent).toBe('');
    expect(cells[5].textContent).toBe('');
  });

  it('parses leading and trailing cell whitespace correctly', () => {
    const markdownTable = ['|   spaced cell   |', '|---|', '|   value   |'].join('\n');

    const { container } = render(<Markdown text={markdownTable} />);

    expect(container.querySelector('th')?.textContent).toBe('spaced cell');
    expect(container.querySelector('td')?.textContent).toBe('value');
  });

  it('renders nested inline styling within cells correctly', () => {
    const markdownTable = [
      '| Formatting |',
      '|---|',
      '| **bold** *italic* [link](http://test) |',
    ].join('\n');

    const { container } = render(<Markdown text={markdownTable} />);

    const cell = container.querySelector('td');
    expect(cell).toBeInTheDocument();
    expect(cell?.querySelector('strong')?.textContent).toBe('bold');
    expect(cell?.querySelector('em')?.textContent).toBe('italic');
    expect(cell?.querySelector('a')?.getAttribute('href')).toBe('http://test');
  });

  it('regression: renders inline code nested inside bold table content', () => {
    const markdownTable = [
      '| Module | Description |',
      '| --- | --- |',
      '| **`cli`** | Command entry point |',
    ].join('\n');

    const { container } = render(<Markdown text={markdownTable} />);

    const cell = container.querySelector('tbody td');
    expect(cell?.querySelector('strong > code')?.textContent).toBe('cli');
  });

  it('regression: retains table columns when malformed code delimiters are unclosed', () => {
    const markdownTable = [
      '| Module | Description | Reference |',
      '| --- | --- | --- |',
      '| **`agent_stats/`` | Agent usage statistics | - |',
      '| **`token_usage/`` | Token management | - |',
    ].join('\n');

    const { container } = render(<Markdown text={markdownTable} />);

    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelectorAll('td')).toHaveLength(3);
    expect(rows[1].querySelectorAll('td')).toHaveLength(3);
    expect(rows[0].textContent).toContain('Agent usage statistics');
    expect(rows[1].textContent).toContain('Token management');
  });

  it.each(['---', '***', '___', '- - -', '* * *', '_ _ _'])(
    'renders %s as a thematic break',
    (marker) => {
      const { container } = render(<Markdown text={`Before\n\n${marker}\n\nAfter`} />);

      expect(container.querySelector('hr')).toBeInTheDocument();
      expect(container.textContent).toBe('BeforeAfter');
    },
  );

  it('renders YAML front matter as metadata instead of thematic breaks', () => {
    const markdown = ['---', 'title: QwenPaw', 'tags:', '  - agents', '---', '', '# Overview'].join(
      '\n',
    );

    const { container } = render(<Markdown text={markdown} />);

    expect(container.querySelector('.markdown-frontmatter')).toHaveTextContent('title: QwenPaw');
    expect(container.querySelector('.markdown-frontmatter')).toHaveTextContent('- agents');
    expect(container.querySelectorAll('hr')).toHaveLength(0);
    expect(container.querySelector('h1')?.textContent).toBe('Overview');
  });

  it('regression: renders plain markdown file references as clickable editor links', () => {
    vi.mocked(window.vscode.postMessage).mockClear();
    render(<Markdown text="Open src/extension/index.ts:42 and README.md:1." />);

    fireEvent.click(screen.getByRole('button', { name: 'src/extension/index.ts:42' }));

    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'file:open',
      path: 'src/extension/index.ts',
      startLine: 42,
    });
    expect(screen.getByRole('button', { name: 'README.md:1' })).toBeInTheDocument();
  });

  it('regression: opens markdown links that target local files without breaking external links', () => {
    vi.mocked(window.vscode.postMessage).mockClear();
    render(
      <Markdown text="See [selection](src/app.ts:10-12) and [docs](https://example.com/a.ts:10)." />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'selection' }));

    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'file:open',
      path: 'src/app.ts',
      startLine: 10,
      endLine: 12,
    });
    const externalLink = screen.getByRole('link', { name: 'docs' });
    expect(externalLink).toHaveAttribute('href', 'https://example.com/a.ts:10');
    expect(externalLink).toHaveAttribute('data-custom-title', 'Open https://example.com/a.ts:10');
  });

  it('regression: attaches custom tooltip title to external markdown links', () => {
    render(<Markdown text="Check out [OpenCode Docs](https://opencode.ai/docs)." />);
    const link = screen.getByRole('link', { name: 'OpenCode Docs' });
    expect(link).toHaveAttribute('data-custom-title', 'Open https://opencode.ai/docs');
    expect(link).toHaveClass('markdown-link');
  });

  it('renders ordered lists separated by empty lines in a single list (loose lists)', () => {
    const { container } = render(
      <Markdown text={['1. First', '', '2. Second', '', '3. Third'].join('\n')} />,
    );
    const ol = container.querySelector('ol');
    expect(ol).toBeInTheDocument();
    const items = ol?.querySelectorAll('li');
    expect(items).toHaveLength(3);
    expect(items?.[0].textContent).toBe('First');
    expect(items?.[1].textContent).toBe('Second');
    expect(items?.[2].textContent).toBe('Third');
    expect(container.querySelectorAll('ol')).toHaveLength(1);
  });

  it('renders unordered lists separated by empty lines in a single list', () => {
    const { container } = render(
      <Markdown text={['- Item A', '', '- Item B', '', '- Item C'].join('\n')} />,
    );
    const ul = container.querySelector('ul');
    expect(ul).toBeInTheDocument();
    const items = ul?.querySelectorAll('li');
    expect(items).toHaveLength(3);
    expect(items?.[0].textContent).toBe('Item A');
    expect(items?.[1].textContent).toBe('Item B');
    expect(items?.[2].textContent).toBe('Item C');
    expect(container.querySelectorAll('ul')).toHaveLength(1);
  });

  it('correctly splits lists when changing type across an empty line', () => {
    const { container } = render(
      <Markdown text={['1. Ordered Item', '', '- Unordered Item'].join('\n')} />,
    );
    expect(container.querySelectorAll('ol')).toHaveLength(1);
    expect(container.querySelectorAll('ul')).toHaveLength(1);
    expect(container.querySelector('ol')?.textContent).toBe('Ordered Item');
    expect(container.querySelector('ul')?.textContent).toBe('Unordered Item');
  });

  it('regression: parses and renders custom inline attachment chips when matches exist', () => {
    const text =
      'Here is a file [File: CHANGELOG.md] and a text snippet [Text: Pasted 2 Lines] and unmatched [File: missing.txt].';
    const allParts = [
      {
        id: 'part-1',
        type: 'file',
        filename: 'CHANGELOG.md',
        url: 'file:///workspace/CHANGELOG.md',
      },
      {
        id: 'part-2',
        type: 'text',
        text: 'line 1\nline 2',
        metadata: {
          type: 'pasted-text',
          filename: 'Pasted 2 Lines',
          linesCount: 2,
        },
      },
    ] as unknown as Part[];

    const { container } = render(<Markdown text={text} allParts={allParts} />);

    const chipWrappers = container.querySelectorAll('.opencode-chip-inline-wrapper');
    expect(chipWrappers).toHaveLength(2);

    expect(screen.getByText('CHANGELOG.md')).toBeInTheDocument();
    expect(screen.getByText('Pasted 2 Lines')).toBeInTheDocument();
    expect(screen.queryByText('missing.txt')).not.toBeInTheDocument();
    expect(screen.getByText(/unmatched \[File: missing.txt\]/)).toBeInTheDocument();
  });

  it('regression: passes source path to file chip during markdown inline rendering', () => {
    const text = 'Check [File: CHANGELOG.md] for details.';
    const allParts = [
      {
        id: 'part-1',
        type: 'file',
        filename: 'CHANGELOG.md',
        url: 'data:text/plain;base64,aGVsbG8=',
        source: {
          type: 'file' as const,
          path: 'relative/CHANGELOG.md',
          text: {
            value: 'hello',
            start: 1,
            end: 1,
          },
        },
      },
    ] as unknown as Part[];

    const { container } = render(<Markdown text={text} allParts={allParts} />);

    const chipElement = container.querySelector('.opencode-chip');
    expect(chipElement).toBeInTheDocument();
    const tooltipContent = getRegisteredTooltipContent(
      chipElement?.getAttribute('data-custom-title-content') ?? null,
    );
    render(<>{tooltipContent}</>);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('regression: renders custom Code Selection inline chips with range and text values', () => {
    const text = 'Refactoring [[Code Selection: index.ts [10-20]]] here.';
    const allParts = [
      {
        id: 'code-part',
        type: 'file',
        filename: 'index.ts [10-20]',
        url: 'file:///workspace/index.ts',
        source: {
          type: 'file' as const,
          path: 'index.ts',
          text: {
            value: 'console.log("hello");\nconst x = 5;',
            start: 10,
            end: 20,
          },
        },
      },
    ] as unknown as Part[];

    const { container } = render(<Markdown text={text} allParts={allParts} />);
    const chipWrapper = container.querySelector('.opencode-chip-inline-wrapper');
    expect(chipWrapper).toBeInTheDocument();
    expect(screen.getByText('index.ts [10-20]')).toBeInTheDocument();
  });

  it('regression: renders Terminal inline chips correctly', () => {
    const text = 'Executed command logs [Terminal: 5 lines]';
    const allParts = [
      {
        id: 'terminal-part',
        type: 'file',
        filename: 'terminal [5 lines]',
        url: 'data:text/plain;base64,bGlzdAo=',
        source: {
          type: 'file' as const,
          path: 'terminal-logs',
          text: {
            value: 'test output',
            start: 1,
            end: 5,
          },
        },
      },
    ] as unknown as Part[];

    const { container } = render(<Markdown text={text} allParts={allParts} />);
    const chipWrapper = container.querySelector('.opencode-chip-inline-wrapper');
    expect(chipWrapper).toBeInTheDocument();
    expect(screen.getByText('terminal [5 lines]')).toBeInTheDocument();
  });

  it('regression: renders Directory inline chips correctly without line range suffix and uses folder icon', () => {
    const text = 'Here is a folder [File: memory].';
    const allParts = [
      {
        id: 'dir-part',
        type: 'file',
        filename: 'memory',
        mime: 'directory',
        url: 'file:///workspace/memory',
        source: {
          type: 'file' as const,
          path: 'memory',
        },
      },
    ] as unknown as Part[];

    const { container } = render(<Markdown text={text} allParts={allParts} />);
    const chipElement = container.querySelector('.opencode-chip');
    expect(chipElement).toBeInTheDocument();
    expect(chipElement).toHaveClass('file-chip');
    expect(screen.getByText('memory')).toBeInTheDocument();
    expect(screen.queryByText('memory [1-1]')).not.toBeInTheDocument();
    const iconElement = container.querySelector('.codicon-folder');
    expect(iconElement).toBeInTheDocument();
  });

  it('regression: renders application/x-directory inline chips correctly without line range suffix and uses folder icon', () => {
    const text = 'Here is a folder [File: memory].';
    const allParts = [
      {
        id: 'dir-part-app',
        type: 'file',
        filename: 'memory',
        mime: 'application/x-directory',
        url: 'file:///workspace/memory',
        source: {
          type: 'file' as const,
          path: 'memory',
        },
      },
    ] as unknown as Part[];

    const { container } = render(<Markdown text={text} allParts={allParts} />);
    const chipElement = container.querySelector('.opencode-chip');
    expect(chipElement).toBeInTheDocument();
    expect(chipElement).toHaveClass('file-chip');
    expect(screen.getByText('memory')).toBeInTheDocument();
    expect(screen.queryByText('memory [1-1]')).not.toBeInTheDocument();
    const iconElement = container.querySelector('.codicon-folder');
    expect(iconElement).toBeInTheDocument();
  });

  it('regression: renders whole file chip without line range suffix even if source text is populated', () => {
    const text = 'Referencing [File: merges.txt] in chat.';
    const allParts = [
      {
        id: 'part-file-with-text',
        type: 'file',
        filename: 'merges.txt',
        url: 'file:///workspace/merges.txt',
        source: {
          type: 'file' as const,
          path: 'merges.txt',
          text: {
            value: 'file contents',
          },
        },
      },
    ] as unknown as Part[];

    const { container } = render(<Markdown text={text} allParts={allParts} />);
    const chipElement = container.querySelector('.opencode-chip');
    expect(chipElement).toBeInTheDocument();
    expect(chipElement).toHaveClass('file-chip');
    expect(screen.getByText('merges.txt')).toBeInTheDocument();
    expect(screen.queryByText('merges.txt [1-1]')).not.toBeInTheDocument();
  });
});
