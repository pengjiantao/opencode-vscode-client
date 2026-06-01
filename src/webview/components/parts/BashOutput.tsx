/**
 * @file Renders the custom bash execution output with a terminal-like header and an auto-anchoring scroll container.
 */

import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useRef } from 'react';

export interface BashOutputProps {
  /** The executed command string. */
  command: string;
  /** The accumulated output to display. */
  output: string;
  /** The execution status of the tool call (retained for interface compatibility with callers). */
  status: 'pending' | 'running' | 'completed' | 'error';
}

/** Standard terminal ANSI foreground colors mapping to native VS Code CSS variables. */
const ANSI_COLOR_MAP: Record<number, string> = {
  30: 'var(--vscode-terminal-ansiBlack, #000000)',
  31: 'var(--vscode-terminal-ansiRed, #cd3131)',
  32: 'var(--vscode-terminal-ansiGreen, #0dbc79)',
  33: 'var(--vscode-terminal-ansiYellow, #e5e510)',
  34: 'var(--vscode-terminal-ansiBlue, #2472c8)',
  35: 'var(--vscode-terminal-ansiMagenta, #bc3fbc)',
  36: 'var(--vscode-terminal-ansiCyan, #11a8cd)',
  37: 'var(--vscode-terminal-ansiWhite, #e5e5e5)',
  90: 'var(--vscode-terminal-ansiBrightBlack, #666666)',
  91: 'var(--vscode-terminal-ansiBrightRed, #f14c4c)',
  92: 'var(--vscode-terminal-ansiBrightGreen, #23d18b)',
  93: 'var(--vscode-terminal-ansiBrightYellow, #f5f543)',
  94: 'var(--vscode-terminal-ansiBrightBlue, #3b8eea)',
  95: 'var(--vscode-terminal-ansiBrightMagenta, #d670d6)',
  96: 'var(--vscode-terminal-ansiBrightCyan, #29b8db)',
  97: 'var(--vscode-terminal-ansiBrightWhite, #e5e5e5)',
};

/** Standard terminal ANSI background colors mapping to native VS Code CSS variables. */
const ANSI_BG_MAP: Record<number, string> = {
  40: 'var(--vscode-terminal-ansiBlack, #000000)',
  41: 'var(--vscode-terminal-ansiRed, #cd3131)',
  42: 'var(--vscode-terminal-ansiGreen, #0dbc79)',
  43: 'var(--vscode-terminal-ansiYellow, #e5e510)',
  44: 'var(--vscode-terminal-ansiBlue, #2472c8)',
  45: 'var(--vscode-terminal-ansiMagenta, #bc3fbc)',
  46: 'var(--vscode-terminal-ansiCyan, #11a8cd)',
  47: 'var(--vscode-terminal-ansiWhite, #e5e5e5)',
  100: 'var(--vscode-terminal-ansiBrightBlack, #666666)',
  101: 'var(--vscode-terminal-ansiBrightRed, #f14c4c)',
  102: 'var(--vscode-terminal-ansiBrightGreen, #23d18b)',
  103: 'var(--vscode-terminal-ansiBrightYellow, #f5f543)',
  104: 'var(--vscode-terminal-ansiBrightBlue, #3b8eea)',
  105: 'var(--vscode-terminal-ansiBrightMagenta, #d670d6)',
  106: 'var(--vscode-terminal-ansiBrightCyan, #29b8db)',
  107: 'var(--vscode-terminal-ansiBrightWhite, #e5e5e5)',
};

/**
 * Parses standard terminal ANSI escape sequences inside output strings and wraps the content
 * into styled React <span> components to render ANSI colors natively.
 *
 * @param text The raw bash output string containing ANSI escape codes.
 * @returns An array of React nodes representing the styled terminal output chunks.
 */
function parseAnsi(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  // eslint-disable-next-line no-control-regex
  const regex = /\x1b\[([0-9;]*)m/g;
  let lastIndex = 0;
  let currentStyle: CSSProperties = {};
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    const textChunk = text.substring(lastIndex, match.index);
    if (textChunk) {
      parts.push(
        <span key={key++} style={{ ...currentStyle }}>
          {textChunk}
        </span>,
      );
    }

    const codeStr = match[1];
    // Empty sequence or 0 resets all styles
    if (codeStr === '' || codeStr === '0') {
      currentStyle = {};
    } else {
      const codes = codeStr.split(';').map(Number);
      const newStyle: CSSProperties = { ...currentStyle };
      for (const code of codes) {
        if (code === 0) {
          // Reset
          Object.keys(newStyle).forEach((k) => delete newStyle[k as keyof CSSProperties]);
        } else if (code === 1) {
          newStyle.fontWeight = 'bold';
        } else if (code === 2) {
          newStyle.opacity = 0.7; // Dim state representation
        } else if (code === 4) {
          newStyle.textDecoration = 'underline';
        } else if (code >= 30 && code <= 37) {
          newStyle.color = ANSI_COLOR_MAP[code];
        } else if (code === 39) {
          delete newStyle.color;
        } else if (code >= 40 && code <= 47) {
          newStyle.backgroundColor = ANSI_BG_MAP[code];
        } else if (code === 49) {
          delete newStyle.backgroundColor;
        } else if (code >= 90 && code <= 97) {
          newStyle.color = ANSI_COLOR_MAP[code];
        } else if (code >= 100 && code <= 107) {
          newStyle.backgroundColor = ANSI_BG_MAP[code];
        }
      }
      currentStyle = newStyle;
    }

    lastIndex = regex.lastIndex;
  }

  const remaining = text.substring(lastIndex);
  if (remaining) {
    parts.push(
      <span key={key} style={{ ...currentStyle }}>
        {remaining}
      </span>,
    );
  }

  return parts;
}

/**
 * Renders the custom bash execution output with a terminal-like header and an auto-anchoring scroll container.
 * Auto-scroll is only triggered when the user is already near the bottom (within 40px margin of error)
 * so we don't disrupt the user if they've manually scrolled up to inspect previous output.
 * Shows standard $: prompt prefix. No longer shows conditional status icons.
 */
export function BashOutput({ command, output }: BashOutputProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Use requestAnimationFrame to ensure DOM has updated with new content
    // before checking scroll dimensions and scrolling
    const frameId = requestAnimationFrame(() => {
      const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 40;
      if (isAtBottom) {
        el.scrollTop = el.scrollHeight;
      }
    });

    return () => cancelAnimationFrame(frameId);
  }, [output]);

  if (!output) {
    return null;
  }

  return (
    <div className="tool-bash-output">
      <div className="bash-output-header">
        <span className="bash-output-prompt">$: </span>
        <span className="bash-output-command" data-custom-title={command}>
          {command}
        </span>
      </div>
      <div className="bash-output-scroll" ref={scrollRef}>
        <pre>{parseAnsi(output)}</pre>
      </div>
    </div>
  );
}
