/**
 * @file Unit tests for extension command helpers.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env, window, workspace } from 'vscode';
import {
  pasteClipboardTextAsPlainText,
  showAgentQuickPick,
  showDefaultSettingsQuickPick,
  showModelQuickPick,
} from './commands';
import type { IPCBridge } from './ipc';
import type { SDKClient } from './sdk-client';
import type { AgentInfo, ModelInfo } from './types';

describe('extension command helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(window.createQuickPick).mockClear();
  });

  it('regression: sends clipboard text to the prompt editor as plain text', async () => {
    const readText = vi.fn().mockResolvedValue('plain clipboard text');
    Object.defineProperty(env.clipboard, 'readText', {
      configurable: true,
      value: readText,
    });
    const send = vi.fn();
    const ipc = {
      send,
    } as unknown as IPCBridge;

    await pasteClipboardTextAsPlainText(ipc);

    expect(readText).toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith({
      type: 'editor:paste-plain-text',
      text: 'plain clipboard text',
    });
  });
});

/** Helper to create a mock QuickPick with capturable callbacks. */
function createMockQuickPick() {
  let acceptCb: (() => void) | null = null;
  let buttonCb: ((button: unknown) => void) | null = null;
  let hideCb: (() => void) | null = null;

  const qp = {
    title: '',
    placeholder: '',
    items: [] as Array<{ label: string; description?: string; kind?: number; id?: string }>,
    buttons: [] as unknown[],
    selectedItems: [] as Array<{ label: string; id?: string }>,
    /** Set this before calling the function to simulate a button click on show(). */
    pendingButton: null as unknown,
    show: vi.fn(() => {
      if (qp.pendingButton === true && qp.buttons.length > 0) {
        // Simulate clicking the first title bar button
        buttonCb?.(qp.buttons[0]);
      } else if (qp.selectedItems.length > 0) {
        acceptCb?.();
      } else {
        hideCb?.();
      }
    }),
    hide: vi.fn(() => {
      hideCb?.();
    }),
    dispose: vi.fn(),
    onDidAccept: vi.fn((cb: () => void) => {
      acceptCb = cb;
      return { dispose: vi.fn() };
    }),
    onDidTriggerButton: vi.fn((cb: (button: unknown) => void) => {
      buttonCb = cb;
      return { dispose: vi.fn() };
    }),
    onDidHide: vi.fn((cb: () => void) => {
      hideCb = cb;
      return { dispose: vi.fn() };
    }),
  };

  return {
    qp,
    triggerButton: (btn: unknown) => buttonCb?.(btn),
  };
}

function createMockSdk(overrides?: { models?: ModelInfo[]; agents?: AgentInfo[] }): SDKClient {
  return {
    getModels: vi.fn().mockResolvedValue(overrides?.models ?? []),
    getAgents: vi.fn().mockResolvedValue(overrides?.agents ?? []),
  } as unknown as SDKClient;
}

describe('showDefaultSettingsQuickPick', () => {
  it('creates a QuickPick with model and agent options', async () => {
    const mock = createMockQuickPick();
    vi.mocked(window.createQuickPick).mockReturnValue(
      mock.qp as unknown as ReturnType<typeof window.createQuickPick>,
    );
    const sdk = createMockSdk();

    // Trigger hide immediately to resolve the promise
    mock.qp.onDidHide.mockImplementation((cb: () => void) => {
      cb();
      return { dispose: vi.fn() };
    });

    await showDefaultSettingsQuickPick(sdk);

    expect(window.createQuickPick).toHaveBeenCalled();
    expect(mock.qp.title).toBe('OpenCode Settings');
    expect(mock.qp.items).toHaveLength(2);
    expect(mock.qp.items[0].label).toContain('Default Model');
    expect(mock.qp.items[1].label).toContain('Default Agent');
    expect(mock.qp.show).toHaveBeenCalled();
  });

  it('opens model QuickPick when model option is selected', async () => {
    const settingsMock = createMockQuickPick();
    const modelMock = createMockQuickPick();
    vi.mocked(window.createQuickPick)
      .mockReturnValueOnce(settingsMock.qp as unknown as ReturnType<typeof window.createQuickPick>)
      .mockReturnValueOnce(modelMock.qp as unknown as ReturnType<typeof window.createQuickPick>);

    const sdk = createMockSdk({
      models: [
        { id: 'anthropic/claude', name: 'Claude', providerName: 'Anthropic', isConnected: true },
      ],
    });

    // Settings quickpick: select model option (must include 'setting' field)
    settingsMock.qp.selectedItems = [
      { label: 'Default Model', id: 'model', setting: 'model' } as never,
    ];

    await showDefaultSettingsQuickPick(sdk);

    // Model quickpick should have been configured with a title
    expect(modelMock.qp.title).toBe('Default Model');
  });

  it('does nothing when user dismisses the settings QuickPick', async () => {
    const settingsMock = createMockQuickPick();
    vi.mocked(window.createQuickPick).mockReturnValue(
      settingsMock.qp as unknown as ReturnType<typeof window.createQuickPick>,
    );
    const getModelsFn = vi.fn().mockResolvedValue([]);
    const getAgentsFn = vi.fn().mockResolvedValue([]);
    const sdk = { getModels: getModelsFn, getAgents: getAgentsFn } as unknown as SDKClient;

    // No items selected — simulates pressing Escape
    settingsMock.qp.selectedItems = [];

    await showDefaultSettingsQuickPick(sdk);

    // SDK should not be called (model/agent QuickPick not opened)
    expect(getModelsFn).not.toHaveBeenCalled();
    expect(getAgentsFn).not.toHaveBeenCalled();
  });
});

describe('showModelQuickPick', () => {
  it('groups models by provider and shows connected only', async () => {
    const mock = createMockQuickPick();
    vi.mocked(window.createQuickPick).mockReturnValue(
      mock.qp as unknown as ReturnType<typeof window.createQuickPick>,
    );

    const sdk = createMockSdk({
      models: [
        { id: 'anthropic/claude', name: 'Claude', providerName: 'Anthropic', isConnected: true },
        { id: 'anthropic/haiku', name: 'Haiku', providerName: 'Anthropic', isConnected: true },
        { id: 'openai/gpt4', name: 'GPT-4', providerName: 'OpenAI', isConnected: false },
      ],
    });

    await showModelQuickPick(sdk);

    expect(mock.qp.title).toBe('Default Model');
    // Should have: Anthropic separator + 2 models (no OpenAI since disconnected)
    const labels = mock.qp.items.map((i) => i.label);
    expect(labels).toContain('Anthropic');
    expect(labels).toContain('Claude');
    expect(labels).toContain('Haiku');
    expect(labels).not.toContain('GPT-4');
  });

  it('marks the current default model with a check icon', async () => {
    const mock = createMockQuickPick();
    vi.mocked(window.createQuickPick).mockReturnValue(
      mock.qp as unknown as ReturnType<typeof window.createQuickPick>,
    );

    // Mock workspace.getConfiguration to return a current model
    const mockGet = vi.fn().mockImplementation((key: string, defaultValue: unknown) => {
      if (key === 'model') return 'anthropic/claude';
      return defaultValue;
    });
    vi.mocked(workspace.getConfiguration).mockReturnValue({
      get: mockGet,
      update: vi.fn(),
    } as never);

    const sdk = createMockSdk({
      models: [
        { id: 'anthropic/claude', name: 'Claude', providerName: 'Anthropic', isConnected: true },
      ],
    });

    await showModelQuickPick(sdk);

    const claudeItem = mock.qp.items.find((i) => i.id === 'anthropic/claude');
    expect(claudeItem).toBeDefined();
    expect(claudeItem?.label).toContain('$(check)');
  });

  it('shows clear button in title bar when a default is set', async () => {
    const mock = createMockQuickPick();
    vi.mocked(window.createQuickPick).mockReturnValue(
      mock.qp as unknown as ReturnType<typeof window.createQuickPick>,
    );

    const mockGet = vi.fn().mockImplementation((key: string, defaultValue: unknown) => {
      if (key === 'model') return 'anthropic/claude';
      return defaultValue;
    });
    vi.mocked(workspace.getConfiguration).mockReturnValue({
      get: mockGet,
      update: vi.fn(),
    } as never);

    const sdk = createMockSdk({
      models: [
        { id: 'anthropic/claude', name: 'Claude', providerName: 'Anthropic', isConnected: true },
      ],
    });

    await showModelQuickPick(sdk);

    expect(mock.qp.buttons).toHaveLength(1);
    expect(mock.qp.buttons[0]).toHaveProperty('tooltip');
  });

  it('does not show clear button when no default is set', async () => {
    const mock = createMockQuickPick();
    vi.mocked(window.createQuickPick).mockReturnValue(
      mock.qp as unknown as ReturnType<typeof window.createQuickPick>,
    );

    const mockGet = vi.fn().mockReturnValue('');
    vi.mocked(workspace.getConfiguration).mockReturnValue({
      get: mockGet,
      update: vi.fn(),
    } as never);

    const sdk = createMockSdk({
      models: [
        { id: 'anthropic/claude', name: 'Claude', providerName: 'Anthropic', isConnected: true },
      ],
    });

    await showModelQuickPick(sdk);

    expect(mock.qp.buttons).toHaveLength(0);
  });

  it('sets model configuration when a model is selected', async () => {
    const mock = createMockQuickPick();
    vi.mocked(window.createQuickPick).mockReturnValue(
      mock.qp as unknown as ReturnType<typeof window.createQuickPick>,
    );

    const updateMock = vi.fn();
    const mockGet = vi.fn().mockReturnValue('');
    vi.mocked(workspace.getConfiguration).mockReturnValue({
      get: mockGet,
      update: updateMock,
    } as never);

    const sdk = createMockSdk({
      models: [
        { id: 'anthropic/claude', name: 'Claude', providerName: 'Anthropic', isConnected: true },
      ],
    });

    // Simulate selecting the Claude model
    mock.qp.selectedItems = [{ label: 'Claude', id: 'anthropic/claude' }];
    mock.qp.onDidAccept.mockImplementation((cb: () => void) => {
      cb();
      return { dispose: vi.fn() };
    });

    await showModelQuickPick(sdk);

    expect(updateMock).toHaveBeenCalledWith('model', 'anthropic/claude', true);
    expect(window.showInformationMessage).toHaveBeenCalledWith(
      'Default model set to anthropic/claude.',
    );
  });

  it('clears model configuration when clear button is clicked', async () => {
    const mock = createMockQuickPick();
    vi.mocked(window.createQuickPick).mockReturnValue(
      mock.qp as unknown as ReturnType<typeof window.createQuickPick>,
    );

    const updateMock = vi.fn();
    const mockGet = vi.fn().mockImplementation((key: string, defaultValue: unknown) => {
      if (key === 'model') return 'anthropic/claude';
      return defaultValue;
    });
    vi.mocked(workspace.getConfiguration).mockReturnValue({
      get: mockGet,
      update: updateMock,
    } as never);

    const sdk = createMockSdk({
      models: [
        { id: 'anthropic/claude', name: 'Claude', providerName: 'Anthropic', isConnected: true },
      ],
    });

    // Simulate clicking the clear button on show()
    mock.qp.buttons = [{ iconPath: 'close', tooltip: 'Clear Default' }];
    mock.qp.pendingButton = true;

    await showModelQuickPick(sdk);

    expect(updateMock).toHaveBeenCalledWith('model', '', true);
    expect(window.showInformationMessage).toHaveBeenCalledWith('Default model cleared.');
  });

  it('shows error message when SDK fails to load models', async () => {
    const sdk = createMockSdk();
    (sdk.getModels as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('SDK error'));

    await showModelQuickPick(sdk);

    expect(window.showErrorMessage).toHaveBeenCalledWith('Failed to load available models.');
  });

  it('shows info message when no models are available', async () => {
    const sdk = createMockSdk({ models: [] });

    await showModelQuickPick(sdk);

    expect(window.showInformationMessage).toHaveBeenCalledWith(
      'No models available. Check your provider connections.',
    );
  });

  it('shows info message when no connected providers exist', async () => {
    const sdk = createMockSdk({
      models: [{ id: 'openai/gpt4', name: 'GPT-4', providerName: 'OpenAI', isConnected: false }],
    });

    await showModelQuickPick(sdk);

    expect(window.showInformationMessage).toHaveBeenCalledWith(
      'No connected providers. Check your provider configuration.',
    );
  });
});

describe('showAgentQuickPick', () => {
  it('shows only visible primary agents', async () => {
    const mock = createMockQuickPick();
    vi.mocked(window.createQuickPick).mockReturnValue(
      mock.qp as unknown as ReturnType<typeof window.createQuickPick>,
    );

    const sdk = createMockSdk({
      agents: [
        { id: 'build', name: 'build', mode: 'primary' },
        { id: 'plan', name: 'plan', mode: 'primary' },
        { id: 'helper', name: 'helper', mode: 'subagent' },
        { id: 'secret', name: 'secret', hidden: true },
      ],
    });

    await showAgentQuickPick(sdk);

    expect(mock.qp.title).toBe('Default Agent');
    const labels = mock.qp.items.map((i) => i.label);
    expect(labels).toContain('build');
    expect(labels).toContain('plan');
    expect(labels).not.toContain('helper');
    expect(labels).not.toContain('secret');
  });

  it('marks the current default agent with a check icon', async () => {
    const mock = createMockQuickPick();
    vi.mocked(window.createQuickPick).mockReturnValue(
      mock.qp as unknown as ReturnType<typeof window.createQuickPick>,
    );

    const mockGet = vi.fn().mockImplementation((key: string, defaultValue: unknown) => {
      if (key === 'agent') return 'build';
      return defaultValue;
    });
    vi.mocked(workspace.getConfiguration).mockReturnValue({
      get: mockGet,
      update: vi.fn(),
    } as never);

    const sdk = createMockSdk({
      agents: [{ id: 'build', name: 'build', mode: 'primary' }],
    });

    await showAgentQuickPick(sdk);

    const buildItem = mock.qp.items.find((i) => i.id === 'build');
    expect(buildItem?.label).toContain('$(check)');
  });

  it('sets agent configuration when an agent is selected', async () => {
    const mock = createMockQuickPick();
    vi.mocked(window.createQuickPick).mockReturnValue(
      mock.qp as unknown as ReturnType<typeof window.createQuickPick>,
    );

    const updateMock = vi.fn();
    const mockGet = vi.fn().mockReturnValue('');
    vi.mocked(workspace.getConfiguration).mockReturnValue({
      get: mockGet,
      update: updateMock,
    } as never);

    const sdk = createMockSdk({
      agents: [{ id: 'build', name: 'build', mode: 'primary' }],
    });

    mock.qp.selectedItems = [{ label: 'build', id: 'build' }];
    mock.qp.onDidAccept.mockImplementation((cb: () => void) => {
      cb();
      return { dispose: vi.fn() };
    });

    await showAgentQuickPick(sdk);

    expect(updateMock).toHaveBeenCalledWith('agent', 'build', true);
    expect(window.showInformationMessage).toHaveBeenCalledWith('Default agent set to build.');
  });

  it('clears agent configuration when clear button is clicked', async () => {
    const mock = createMockQuickPick();
    vi.mocked(window.createQuickPick).mockReturnValue(
      mock.qp as unknown as ReturnType<typeof window.createQuickPick>,
    );

    const updateMock = vi.fn();
    const mockGet = vi.fn().mockImplementation((key: string, defaultValue: unknown) => {
      if (key === 'agent') return 'build';
      return defaultValue;
    });
    vi.mocked(workspace.getConfiguration).mockReturnValue({
      get: mockGet,
      update: updateMock,
    } as never);

    const sdk = createMockSdk({
      agents: [{ id: 'build', name: 'build', mode: 'primary' }],
    });

    // Simulate clicking the clear button on show()
    mock.qp.buttons = [{ iconPath: 'close', tooltip: 'Clear Default' }];
    mock.qp.pendingButton = true;

    await showAgentQuickPick(sdk);

    expect(updateMock).toHaveBeenCalledWith('agent', '', true);
    expect(window.showInformationMessage).toHaveBeenCalledWith('Default agent cleared.');
  });

  it('shows error message when SDK fails to load agents', async () => {
    const sdk = createMockSdk();
    (sdk.getAgents as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('SDK error'));

    await showAgentQuickPick(sdk);

    expect(window.showErrorMessage).toHaveBeenCalledWith('Failed to load available agents.');
  });

  it('shows info message when no agents are available', async () => {
    const sdk = createMockSdk({ agents: [] });

    await showAgentQuickPick(sdk);

    expect(window.showInformationMessage).toHaveBeenCalledWith('No agents available.');
  });
});
