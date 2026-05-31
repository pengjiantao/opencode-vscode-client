/**
 * @file Renders a tool call part with its status, input, output, and error states in a borderless collapsible block.
 */

import { useState } from 'react';
import { Codicon } from '../Codicon';
import { BashOutput } from './BashOutput';
import { DiffPart } from './DiffPart';

interface ToolPartProps {
  tool: string;
  state: {
    status: 'pending' | 'running' | 'completed' | 'error';
    input?: Record<string, unknown>;
    output?: string;
    title?: string;
    error?: string;
    time?: { start: number; end?: number };
    metadata?: Record<string, unknown>;
  };
  hasPredecessor?: boolean;
  hasSuccessor?: boolean;
}

/**
 * Checks whether a given tool name refers to a bash-like shell or command execution tool.
 *
 * @param tool The raw tool name (e.g., 'bash', 'grep_search', 'write_to_file')
 * @returns True if the tool name corresponds to a bash/shell command tool.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function isBashTool(tool: string): boolean {
  const name = tool.toLowerCase();
  return /bash|shell|command|terminal|run_command/.test(name);
}

/**
 * Resolves the appropriate VS Code Codicon class name or identifier for a given tool name.
 * Maps common tools like bash, grep, search, files, and browsers to their corresponding icons.
 *
 * @param tool The raw tool name (e.g., 'bash', 'grep_search', 'write_to_file')
 * @returns The codicon icon name string (e.g., '$(terminal)')
 */
// eslint-disable-next-line react-refresh/only-export-components
export function getToolIcon(tool: string): string {
  const name = tool.toLowerCase();
  // Match specialized browser/web search tools first before general search to avoid keyword overlap (e.g., browser_search)
  if (name.includes('browser') || name.includes('web') || name.includes('url')) {
    return '$(browser)';
  }
  // Map bash/terminal commands to terminal icon
  if (isBashTool(tool)) {
    return '$(terminal)';
  }
  // Map search / pattern matching to search icon
  if (name.includes('grep') || name.includes('search')) {
    return '$(search)';
  }
  // Map list_dir / folder operations to folder icon
  if (name.includes('list_dir') || name.includes('list_directory') || name.includes('folder')) {
    return '$(folder)';
  }
  // Map edit / write / save operations to edit icon
  if (
    name.includes('write') ||
    name.includes('replace') ||
    name.includes('edit') ||
    name.includes('save')
  ) {
    return '$(edit)';
  }
  // Map read / view file operations to file-code icon
  if (name.includes('read') || name.includes('view') || name.includes('file')) {
    return '$(file-code)';
  }
  // Map question tool to question icon
  if (name.includes('question')) {
    return '$(question)';
  }
  // Fallback to a general toolbox/tools icon
  return '$(tools)';
}

/**
 * Constructs a synthetic unified diff from a file-writing tool's input.
 * This simulates a creation diff (from /dev/null to the new file path)
 * so that we can render the written content in the standard diff viewer.
 *
 * @param input The tool input record containing the content and optional path details.
 * @returns A unified diff string, or undefined if content is not a string.
 */
function getSyntheticWriteDiff(input?: Record<string, unknown>): string | undefined {
  if (!input || typeof input.content !== 'string') {
    return undefined;
  }
  const filePath = (input.filePath ||
    input.TargetFile ||
    input.targetFile ||
    input.path ||
    'file') as string;
  const content = input.content;
  const lines = content === '' ? [] : content.split(/\r?\n/);
  const lineCount = lines.length;
  // Construct the unified diff headers representing a newly created file.
  const diffHeader = `--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${lineCount} @@`;
  const diffBody = lines.map((line) => `+${line}`).join('\n');
  return `${diffHeader}\n${diffBody}`;
}

/**
 * Generates a user-friendly descriptive text for a tool execution.
 * Inspects tool input arguments to construct descriptions showing files,
 * search queries, or commands, falling back to the title or tool name.
 *
 * @param tool The name of the tool.
 * @param input Optional tool execution input parameters.
 * @param title Optional title provided by the execution state.
 * @returns Human-readable description of the tool's action.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function getToolDescription(
  tool: string,
  input?: Record<string, unknown>,
  title?: string,
): string {
  const name = tool.toLowerCase();

  // Extract file path inputs from the tool arguments
  const filePath = (input?.filePath ||
    input?.TargetFile ||
    input?.targetFile ||
    input?.path ||
    input?.AbsolutePath) as string | undefined;

  // Extract command line strings for run/bash tools
  const command = (input?.command || input?.CommandLine) as string | undefined;

  // Extract search queries for grep or general search
  const query = (input?.query || input?.Query) as string | undefined;

  // Extract directory path details
  const dirPath = (input?.DirectoryPath || input?.path) as string | undefined;

  // Helper to extract the last path segment (filename or directory name)
  const getBasename = (fullPath?: string): string => {
    if (!fullPath) return '';
    const cleanPath = fullPath.replace(/\\/g, '/');
    const segments = cleanPath.split('/').filter(Boolean);
    return segments[segments.length - 1] || '';
  };

  const basename = getBasename(filePath);

  if (name === 'read_file' || name === 'view_file') {
    return title || (basename ? `Read file ${basename}` : 'Read file');
  }
  if (name === 'write_file' || name === 'write_to_file') {
    return title || (basename ? `Create file ${basename}` : 'Create file');
  }
  if (name === 'edit' || name === 'replace_file_content' || name === 'multi_replace_file_content') {
    return title || (basename ? `Edit file ${basename}` : 'Edit file');
  }
  if (name === 'grep_search') {
    return title || (query ? `Search for "${query}"` : 'Search content');
  }
  if (name === 'glob') {
    const pattern = (input?.pattern || input?.Pattern) as string | undefined;
    return title || (pattern ? `Search files matching "${pattern}"` : 'Search files');
  }
  if (name === 'list_dir' || name === 'list_directory') {
    const dirBasename = getBasename(dirPath);
    return title || (dirBasename ? `List directory ${dirBasename}` : 'List directory');
  }
  if (isBashTool(tool)) {
    return title || (command ? `Run command "${command}"` : 'Run command');
  }

  return title || tool;
}

/** Displays a tool execution in a collapsible borderless box, default collapsed.
 *  File-modifying, question, and bash tools default to expanded; other tools
 *  default to collapsed with lazy content mounting for performance. */
export function ToolPart({
  tool,
  state,
  hasPredecessor = false,
  hasSuccessor = false,
}: ToolPartProps) {
  const toolName = tool.toLowerCase();
  const isBash = isBashTool(tool);

  // File modifying, question, and bash tools should be default expanded (collapsed = false).
  // Other tools (e.g., grep_search, glob) default to collapsed with lazy content mounting.
  const isDefaultExpanded =
    toolName === 'edit' ||
    toolName === 'write' ||
    toolName === 'write_to_file' ||
    toolName === 'apply_patch' ||
    toolName === 'question' ||
    isBash;

  const [collapsed, setCollapsed] = useState(!isDefaultExpanded);

  // Track whether content has ever been expanded to avoid mounting expensive
  // content (e.g., DiffPart with large diffs) until the user actually opens it.
  const [hasBeenExpanded, setHasBeenExpanded] = useState(isDefaultExpanded);

  const handleToggle = () => {
    if (collapsed) {
      setHasBeenExpanded(true);
    }
    setCollapsed(!collapsed);
  };

  const isEditOrWrite = toolName === 'edit' || toolName === 'write' || toolName === 'write_to_file';

  const hasDiffText =
    isEditOrWrite &&
    ((state.metadata?.diff && typeof state.metadata.diff === 'string') ||
      (state.input && typeof state.input.content === 'string'));

  const hasApplyPatchFiles =
    toolName === 'apply_patch' &&
    Array.isArray(state.metadata?.files) &&
    state.metadata.files.length > 0;

  const hasDiff = hasDiffText || hasApplyPatchFiles;

  // Omit "Tool:" prefix to keep the sidebar presentation compact and developer-centric
  const getSummaryText = () => {
    const desc = getToolDescription(tool, state.input, state.title);
    const prefix = isBash ? 'BASH' : tool.toUpperCase();
    if (desc === prefix || desc === tool) {
      return prefix;
    }
    return `${prefix} - ${desc}`;
  };

  const dotClassName = `timeline-dot tool-dot status-${state.status}`;
  const showLine = hasPredecessor || hasSuccessor;

  /**
   * Conditionally renders the tool output as a diff view if applicable,
   * otherwise falls back to a plain text pre-formatted block.
   */
  const renderOutput = () => {
    // If the tool is a bash-like tool, render using BashOutput component
    if (isBash) {
      const command = (state.input?.command || state.title || '') as string;
      return <BashOutput command={command} output={state.output || ''} status={state.status} />;
    }

    // Check if the tool modifies files and has a diff (either real or synthetic)
    if (isEditOrWrite) {
      let diffText: string | undefined;
      if (state.metadata?.diff && typeof state.metadata.diff === 'string') {
        diffText = state.metadata.diff;
      } else if (state.input && typeof state.input.content === 'string') {
        diffText = getSyntheticWriteDiff(state.input);
      }

      if (diffText) {
        const filePath = (state.input?.filePath ||
          state.input?.TargetFile ||
          state.input?.targetFile ||
          state.input?.path ||
          '') as string;
        // Return only the diff element, omitting label and wrapping div as per instructions
        return <DiffPart diff={diffText} filePath={filePath} status={state.status} />;
      }
    }

    // Check if it is a multi-file patch application tool call
    if (toolName === 'apply_patch' && Array.isArray(state.metadata?.files)) {
      const files = state.metadata.files as Array<Record<string, unknown>>;
      if (files.length > 0) {
        // Return only the file patches directly, omitting the top label and wrapping div
        return (
          <>
            {files.map((file, idx) => {
              const relativePath = (file.relativePath || file.filePath || 'patch') as string;
              const fileType = file.type as string;
              const patch = file.patch as string | undefined;
              const filePath = (file.filePath || '') as string;

              // Construct a user-friendly descriptive action title
              let title = `Patched ${relativePath}`;
              if (fileType === 'delete') {
                title = `Deleted ${relativePath}`;
              } else if (fileType === 'add') {
                title = `Created ${relativePath}`;
              } else if (fileType === 'move') {
                title = `Moved ${filePath} → ${relativePath}`;
              }

              return (
                <div key={`patch-file-${idx}`} className="patch-file-block">
                  <div className="patch-file-title">{title}</div>
                  {patch ? (
                    <DiffPart diff={patch} />
                  ) : (
                    (() => {
                      const deletions = typeof file.deletions === 'number' ? file.deletions : 0;
                      return (
                        <div className="patch-file-summary">
                          -{deletions} line{deletions === 1 ? '' : 's'}
                        </div>
                      );
                    })()
                  )}
                </div>
              );
            })}
          </>
        );
      }
    }

    // Render completed question tool questions & answers
    if (toolName === 'question' && state.status === 'completed') {
      const questions = state.input?.questions as Array<{ question: string }> | undefined;
      const answers = state.metadata?.answers as Array<Array<string>> | undefined;
      if (questions && answers) {
        return (
          <div data-component="question-answers" className="question-answers-completed">
            {questions.map((qItem, idx) => {
              const ansList = answers[idx] || [];
              return (
                <div key={idx} data-slot="question-answer-item" className="question-answer-item">
                  <div data-slot="question-text" className="question-text">
                    {qItem.question}
                  </div>
                  <div data-slot="answer-text" className="answer-text">
                    {ansList.join(', ') || '(no answer)'}
                  </div>
                </div>
              );
            })}
          </div>
        );
      }
    }

    // Fallback for non-diff/non-patch outputs
    if (!state.output) return null;

    return (
      <div className="tool-output">
        <span className="section-label">Output</span>
        <pre>{state.output}</pre>
      </div>
    );
  };

  return (
    <div
      className={`part tool-part timeline-item status-${state.status} ${collapsed ? 'collapsed' : 'expanded'}`}
    >
      <span className={dotClassName} />
      {showLine && (
        <span
          className={`timeline-line${hasPredecessor ? ' has-predecessor' : ''}${hasSuccessor ? ' has-successor' : ''}`}
        />
      )}
      <div className="tool-header" onClick={handleToggle}>
        <Codicon name={getToolIcon(tool)} className="tool-header-icon" />
        <span className="tool-name" data-custom-title={getSummaryText()}>
          {getSummaryText()}
        </span>
      </div>

      {hasBeenExpanded && (
        <div
          className="collapsible-wrapper"
          style={{
            maxHeight: collapsed ? 0 : '2000px',
            opacity: collapsed ? 0 : 1,
            overflow: 'hidden',
          }}
        >
          <div className="tool-content">
            {/* Hide tool input if a diff is being rendered, it is a question tool, or a bash tool to keep layout clean */}
            {!hasDiff &&
              toolName !== 'question' &&
              !isBash &&
              state.input &&
              Object.keys(state.input).length > 0 && (
                <div className="tool-input">
                  <pre>
                    {Object.entries(state.input)
                      .map(([key, value]) => {
                        const upperKey = key.toUpperCase();
                        const displayVal =
                          typeof value === 'object' && value !== null
                            ? JSON.stringify(value)
                            : String(value);
                        return `${upperKey} ${displayVal}`;
                      })
                      .join('\n')}
                  </pre>
                </div>
              )}

            {renderOutput()}

            {state.error && (
              <div className="tool-error">
                <span className="error-title">
                  <Codicon name="$(error)" /> Error
                </span>
                <pre>{state.error}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
