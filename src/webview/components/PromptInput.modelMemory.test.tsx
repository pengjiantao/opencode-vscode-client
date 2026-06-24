/**
 * @file Regression tests for PromptInput model defaults and session model memory.
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentInfo, ModelInfo } from '../../shared/types';
import { useSessionStore } from '../store/sessionStore';
import { PromptInput } from './PromptInput';

const mockOnSubmit = vi.fn();
const mockOnModelChange = vi.fn();
const mockOnAgentChange = vi.fn();

describe('PromptInput model memory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.setState({
      activeSessionID: 'session-a',
      fileInfos: {},
      commands: [],
      skills: [],
      messages: {},
      workspaceName: 'TestWorkspace',
      lspServers: [],
      mcpServers: [],
      plugins: [],
      extensionVersion: 'test',
      publisher: 'fiyqkrc',
      opencodeVersion: '1.0.0',
    });
  });

  it('regression: does not persist the first SDK model while waiting for session state', () => {
    const models: ModelInfo[] = [
      {
        id: 'disconnected-provider/wrong-default',
        name: 'Wrong Default',
        providerName: 'Disconnected',
        isConnected: false,
      },
      {
        id: 'connected-provider/remembered-default',
        name: 'Remembered Default',
        providerName: 'Connected',
        isConnected: true,
      },
    ];
    const agents: AgentInfo[] = [{ id: 'build', name: 'Build', mode: 'primary' }];

    render(
      <PromptInput
        onSubmit={mockOnSubmit}
        models={models}
        agents={agents}
        activeModel=""
        activeAgent="build"
        onModelChange={mockOnModelChange}
        onAgentChange={mockOnAgentChange}
      />,
    );

    expect(screen.getByRole('combobox', { name: /select model/i })).toHaveTextContent(
      'Remembered Default',
    );
    expect(mockOnModelChange).not.toHaveBeenCalled();
  });
});
