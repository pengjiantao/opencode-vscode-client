/**
 * @file Keyboard shortcut regression tests for PromptInput.
 */

import type { SessionStatus } from '@opencode-ai/sdk/v2/client';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PromptInput } from './PromptInput';

vi.mock('@vscode/webview-ui-toolkit/react', () => ({
  VSCodeButton: ({
    children,
    onClick,
    className,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} className={className} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('../store/sessionStore', () => ({
  useSessionStore: vi.fn(<T,>(selector: (state: Record<string, unknown>) => T): T => {
    const state = {
      activeSessionID: 'session-123',
      commands: [],
      extensionVersion: '0.1.7',
      fileInfos: {},
      lspServers: [],
      messages: {},
      mcpServers: [],
      plugins: [],
      skills: [],
      workspaceName: 'TestWorkspace',
    };
    return selector(state);
  }),
}));

describe('PromptInput keyboard shortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('regression: requests plain-text clipboard paste on Ctrl+Shift+V', () => {
    render(
      <PromptInput
        onSubmit={vi.fn()}
        models={[]}
        agents={[]}
        onModelChange={vi.fn()}
        onAgentChange={vi.fn()}
      />,
    );

    fireEvent.keyDown(screen.getByTestId('prompt-editor'), {
      ctrlKey: true,
      shiftKey: true,
      key: 'V',
      code: 'KeyV',
    });

    expect(window.vscode.postMessage).toHaveBeenCalledWith({
      type: 'clipboard:paste-plain-text',
    });
  });

  it('regression: does not abort on Enter when session is running', () => {
    const onAbort = vi.fn();
    const status: SessionStatus = { type: 'busy' };
    render(
      <PromptInput
        onSubmit={vi.fn()}
        onAbort={onAbort}
        models={[]}
        agents={[]}
        onModelChange={vi.fn()}
        onAgentChange={vi.fn()}
        status={status}
      />,
    );

    fireEvent.keyDown(screen.getByTestId('prompt-editor'), {
      key: 'Enter',
      code: 'Enter',
    });

    expect(onAbort).not.toHaveBeenCalled();
  });
});
