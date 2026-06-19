/**
 * @file Unit tests for extension command helpers.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env, window, workspace } from 'vscode';
import {
  pasteClipboardTextAsPlainText,
  showAgentQuickPick,
  showDefaultSettingsQuickPick,
  showExecutablePathQuickPick,
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
  let valueChangeCb: ((value: string) => void) | null = null;

  const qp = {
    title: '',
    placeholder: '',
    value: '',
    items: [] as Array<{
      label: string;
      description?: string;
      detail?: string;
      kind?: number;
      id?: string;
    }>,
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
    onDidChangeValue: vi.fn((cb: (value: string) => void) => {
      valueChangeCb = cb;
      return { dispose: vi.fn() };
    }),
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
    triggerValueChange: (value: string) => {
      qp.value = value;
      valueChangeCb?.(value);
    },
  };
}

function createMockSdk(overrides?: { models?: ModelInfo[]; agents?: AgentInfo[] }): SDKClient {
  return {
    getModels: vi.fn().mockResolvedValue(overrides?.models ?? []),
    getAgents: vi.fn().mockResolvedValue(overrides?.agents ?? []),
  } as unknown as SDKClient;
}

describe('showDefaultSettingsQuickPick', () => {
  it('creates a QuickPick with model, agent, and executable-path options', async () => {
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
    // Regression: the QuickPick grew from 2 to 3 entries when the opencode
    // executable-path setting was introduced. Asserting the exact count and
    // order catches accidental reordering and forgotten entries.
    expect(mock.qp.items).toHaveLength(3);
    expect(mock.qp.items[0].label).toContain('Default Model');
    expect(mock.qp.items[1].label).toContain('Default Agent');
    expect(mock.qp.items[2].label).toContain('OpenCode Executable');
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

  it('does not put the raw model id into the row description (regression: avoid id noise)', async () => {
    const mock = createMockQuickPick();
    vi.mocked(window.createQuickPick).mockReturnValue(
      mock.qp as unknown as ReturnType<typeof window.createQuickPick>,
    );

    const sdk = createMockSdk({
      models: [
        {
          id: 'opencode-go/kimi-k2.7-code',
          name: 'Kimi K2.7 Code',
          providerName: 'OpenCode Go',
          isConnected: true,
          contextLimit: 200000,
        },
      ],
    });

    await showModelQuickPick(sdk);

    const item = mock.qp.items.find((i) => i.id === 'opencode-go/kimi-k2.7-code');
    expect(item).toBeDefined();
    expect(item?.description).toBeDefined();
    expect(item?.description).not.toBe('opencode-go/kimi-k2.7-code');
    // The full id is still discoverable via the second-line `detail` field.
    expect(item?.detail).toBe('opencode-go/kimi-k2.7-code');
  });

  it('includes provider name and context limit in the row description', async () => {
    const mock = createMockQuickPick();
    vi.mocked(window.createQuickPick).mockReturnValue(
      mock.qp as unknown as ReturnType<typeof window.createQuickPick>,
    );

    const sdk = createMockSdk({
      models: [
        {
          id: 'anthropic/claude',
          name: 'Claude',
          providerName: 'Anthropic',
          isConnected: true,
          contextLimit: 200000,
        },
      ],
    });

    await showModelQuickPick(sdk);

    const item = mock.qp.items.find((i) => i.id === 'anthropic/claude');
    expect(item?.description).toContain('Anthropic');
    expect(item?.description).toContain('200k ctx');
  });

  it('prepends a gift icon to free models in the label', async () => {
    const mock = createMockQuickPick();
    vi.mocked(window.createQuickPick).mockReturnValue(
      mock.qp as unknown as ReturnType<typeof window.createQuickPick>,
    );

    const sdk = createMockSdk({
      models: [
        {
          id: 'opencode/deepseek-v4-flash-free',
          name: 'DeepSeek V4 Flash Free',
          providerName: 'OpenCode Zen',
          isConnected: true,
        },
        {
          id: 'anthropic/claude',
          name: 'Claude',
          providerName: 'Anthropic',
          isConnected: true,
        },
      ],
    });

    await showModelQuickPick(sdk);

    const free = mock.qp.items.find((i) => i.id === 'opencode/deepseek-v4-flash-free');
    const paid = mock.qp.items.find((i) => i.id === 'anthropic/claude');
    expect(free?.label.startsWith('$(gift) ')).toBe(true);
    expect(paid?.label.includes('$(gift)')).toBe(false);
  });

  it('does not mark models with "free" in the middle of the id as free (regression: freedom-model-v1)', async () => {
    const mock = createMockQuickPick();
    vi.mocked(window.createQuickPick).mockReturnValue(
      mock.qp as unknown as ReturnType<typeof window.createQuickPick>,
    );

    const sdk = createMockSdk({
      models: [
        // The literal token "free" appears in the middle, not as a suffix.
        // This is not a free-tier variant under the upstream convention, so
        // it must NOT get the $(gift) icon.
        {
          id: 'anthropic/freedom-model-v1',
          name: 'Freedom',
          providerName: 'Anthropic',
          isConnected: true,
        },
        // "free" appears at the end but not preceded by a separator.
        { id: 'anthropic/cafemodel', name: 'Cafe', providerName: 'Anthropic', isConnected: true },
      ],
    });

    await showModelQuickPick(sdk);

    const freedom = mock.qp.items.find((i) => i.id === 'anthropic/freedom-model-v1');
    const cafe = mock.qp.items.find((i) => i.id === 'anthropic/cafemodel');
    expect(freedom?.label.includes('$(gift)')).toBe(false);
    expect(cafe?.label.includes('$(gift)')).toBe(false);
  });

  it('detects free models with `_free` or `/free` delimiters (not just `-free`)', async () => {
    const mock = createMockQuickPick();
    vi.mocked(window.createQuickPick).mockReturnValue(
      mock.qp as unknown as ReturnType<typeof window.createQuickPick>,
    );

    const sdk = createMockSdk({
      models: [
        {
          id: 'opencode/foo_free',
          name: 'Foo Free',
          providerName: 'OpenCode Zen',
          isConnected: true,
        },
        { id: 'opencode/free', name: 'Free', providerName: 'OpenCode Zen', isConnected: true },
      ],
    });

    await showModelQuickPick(sdk);

    const fooFree = mock.qp.items.find((i) => i.id === 'opencode/foo_free');
    const free = mock.qp.items.find((i) => i.id === 'opencode/free');
    expect(fooFree?.label.startsWith('$(gift) ')).toBe(true);
    expect(free?.label.startsWith('$(gift) ')).toBe(true);
  });

  it('matches the current model case-insensitively (regression: manual settings.json casing)', async () => {
    const mock = createMockQuickPick();
    vi.mocked(window.createQuickPick).mockReturnValue(
      mock.qp as unknown as ReturnType<typeof window.createQuickPick>,
    );

    // Simulate a user who hand-edited settings.json with a different casing
    // for the configured model id. The check icon must still appear.
    const mockGet = vi.fn().mockImplementation((key: string, defaultValue: unknown) => {
      if (key === 'model') return 'Anthropic/Claude';
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

    const item = mock.qp.items.find((i) => i.id === 'anthropic/claude');
    expect(item).toBeDefined();
    expect(item?.label).toContain('$(check)');
    expect(item?.description).toContain('current');
  });

  it('filters items by model name when the user types in the search box', async () => {
    const mock = createMockQuickPick();
    // Defer show() so the picker promise stays pending while we drive the
    // search input. Without this, the default show() handler resolves the
    // promise before we can simulate a value change.
    mock.qp.show = vi.fn();
    vi.mocked(window.createQuickPick).mockReturnValue(
      mock.qp as unknown as ReturnType<typeof window.createQuickPick>,
    );

    const sdk = createMockSdk({
      models: [
        {
          id: 'opencode-go/kimi-k2.6',
          name: 'Kimi K2.6',
          providerName: 'OpenCode Go',
          isConnected: true,
        },
        {
          id: 'opencode-go/kimi-k2.7-code',
          name: 'Kimi K2.7 Code',
          providerName: 'OpenCode Go',
          isConnected: true,
        },
        { id: 'anthropic/claude', name: 'Claude', providerName: 'Anthropic', isConnected: true },
      ],
    });

    const promise = showModelQuickPick(sdk);
    // Flush microtasks so the picker is fully initialized (items set,
    // onDidChangeValue registered) before we drive its input.
    await Promise.resolve();

    // Drive the picker's search input as if the user typed "kimi".
    mock.triggerValueChange('kimi');
    const modelRows = mock.qp.items.filter((i) => i.id !== '');
    // Only the two Kimi models should remain; Claude must be filtered out.
    expect(modelRows.map((i) => i.id).sort()).toEqual([
      'opencode-go/kimi-k2.6',
      'opencode-go/kimi-k2.7-code',
    ]);
    // The provider name is still discoverable on the matching rows.
    expect(modelRows.every((i) => i.description?.includes('OpenCode Go'))).toBe(true);

    // Dismiss the picker to let the test finish.
    mock.qp.hide();
    await promise;
  });

  it('filters items by provider name (matches xiaomi under xiaomi-token-plan-cn ids)', async () => {
    const mock = createMockQuickPick();
    mock.qp.show = vi.fn();
    vi.mocked(window.createQuickPick).mockReturnValue(
      mock.qp as unknown as ReturnType<typeof window.createQuickPick>,
    );

    const sdk = createMockSdk({
      models: [
        { id: 'anthropic/claude', name: 'Claude', providerName: 'Anthropic', isConnected: true },
        {
          id: 'xiaomi-token-plan-cn/mimo-v2-pro',
          name: 'MiMo-V2-Pro',
          providerName: 'Xiaomi Token Plan (China)',
          isConnected: true,
        },
      ],
    });

    const promise = showModelQuickPick(sdk);
    await Promise.resolve();

    mock.triggerValueChange('xiaomi');
    const modelRows = mock.qp.items.filter((i) => i.id !== '');
    expect(modelRows.map((i) => i.id)).toEqual(['xiaomi-token-plan-cn/mimo-v2-pro']);

    mock.qp.hide();
    await promise;
  });

  it('filters items by model id substring', async () => {
    const mock = createMockQuickPick();
    mock.qp.show = vi.fn();
    vi.mocked(window.createQuickPick).mockReturnValue(
      mock.qp as unknown as ReturnType<typeof window.createQuickPick>,
    );

    const sdk = createMockSdk({
      models: [
        {
          id: 'opencode-go/mimo-v2.5',
          name: 'MiMo V2.5',
          providerName: 'OpenCode Go',
          isConnected: true,
        },
        {
          id: 'opencode-go/mimo-v2.5-pro',
          name: 'MiMo V2.5 Pro',
          providerName: 'OpenCode Go',
          isConnected: true,
        },
        { id: 'anthropic/claude', name: 'Claude', providerName: 'Anthropic', isConnected: true },
      ],
    });

    const promise = showModelQuickPick(sdk);
    await Promise.resolve();

    mock.triggerValueChange('mimo-v2.5-pro');
    const modelRows = mock.qp.items.filter((i) => i.id !== '');
    expect(modelRows.map((i) => i.id)).toEqual(['opencode-go/mimo-v2.5-pro']);

    mock.qp.hide();
    await promise;
  });

  it('shows a "No models match" row when the filter has no results', async () => {
    const mock = createMockQuickPick();
    mock.qp.show = vi.fn();
    vi.mocked(window.createQuickPick).mockReturnValue(
      mock.qp as unknown as ReturnType<typeof window.createQuickPick>,
    );

    const sdk = createMockSdk({
      models: [
        { id: 'anthropic/claude', name: 'Claude', providerName: 'Anthropic', isConnected: true },
      ],
    });

    const promise = showModelQuickPick(sdk);
    await Promise.resolve();

    mock.triggerValueChange('zzz-no-such-model');
    expect(mock.qp.items).toHaveLength(1);
    expect(mock.qp.items[0].id).toBe('');
    expect(mock.qp.items[0].label).toContain('No models match');
    expect(mock.qp.items[0].label).toContain('zzz-no-such-model');

    mock.qp.hide();
    await promise;
  });

  it('does not set configuration when the user accepts the empty-state row', async () => {
    const mock = createMockQuickPick();
    // Defer show() so the picker promise stays pending until we explicitly
    // simulate user input. This lets us exercise the empty-state rejection
    // path without the test framework auto-resolving the promise.
    mock.qp.show = vi.fn();
    vi.mocked(window.createQuickPick).mockReturnValue(
      mock.qp as unknown as ReturnType<typeof window.createQuickPick>,
    );

    const updateMock = vi.fn();
    const mockGet = vi.fn().mockReturnValue('anthropic/claude');
    vi.mocked(workspace.getConfiguration).mockReturnValue({
      get: mockGet,
      update: updateMock,
    } as never);

    const sdk = createMockSdk({
      models: [
        { id: 'anthropic/claude', name: 'Claude', providerName: 'Anthropic', isConnected: true },
      ],
    });

    const promise = showModelQuickPick(sdk);
    await Promise.resolve();

    // User types a query that matches nothing: items become the empty-state row.
    mock.triggerValueChange('zzz-no-such-model');
    expect(mock.qp.items).toHaveLength(1);
    expect(mock.qp.items[0].id).toBe('');

    // User presses Enter on the empty-state row.
    mock.qp.selectedItems = [mock.qp.items[0]];
    const onDidAcceptMock = mock.qp.onDidAccept as unknown as ReturnType<typeof vi.fn>;
    const lastAcceptCb = onDidAcceptMock.mock.calls.at(-1)?.[0] as (() => void) | undefined;
    expect(lastAcceptCb).toBeDefined();
    lastAcceptCb?.();

    await promise;

    // The empty-state row has no id, so setConfiguration must NOT have been called.
    expect(updateMock).not.toHaveBeenCalled();
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

describe('showExecutablePathQuickPick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears executablePath when the user clicks the Clear button', async () => {
    // Regression: the QuickPick exposes a title-bar "Clear" button so the
    // user can reset the path back to "use PATH" without having to reopen
    // the file dialog and pick nothing.
    const mock = createMockQuickPick();
    vi.mocked(window.createQuickPick).mockReturnValue(
      mock.qp as unknown as ReturnType<typeof window.createQuickPick>,
    );
    const workspaceMock = vi.mocked(workspace.getConfiguration);
    workspaceMock.mockReturnValueOnce({
      get: vi.fn((key: string, defaultValue: unknown) =>
        key === 'executablePath' ? '/usr/local/bin/opencode' : defaultValue,
      ),
      update: vi.fn(),
    } as unknown as ReturnType<typeof workspace.getConfiguration>);

    // Find the clear button that was registered
    let registeredButtons: unknown[] = [];
    const originalShow = mock.qp.show;
    void originalShow;
    mock.qp.buttons = [];
    // Capture the clear button registered when the QuickPick is created
    vi.mocked(window.createQuickPick).mockImplementationOnce(
      () =>
        ({
          ...mock.qp,
          set buttons(value: unknown[]) {
            registeredButtons = value;
            mock.qp.buttons = value;
          },
        }) as unknown as ReturnType<typeof window.createQuickPick>,
    );

    // Resolve the QuickPick via the clear button
    mock.qp.onDidTriggerButton.mockImplementation((cb: (btn: unknown) => void) => {
      // Invoke the clear callback immediately
      const clearButton = registeredButtons[0];
      if (clearButton) cb(clearButton);
      return { dispose: vi.fn() };
    });
    mock.qp.onDidHide.mockImplementation((cb: () => void) => {
      // The flow's `finish` resolves the promise; no further hide needed.
      void cb;
      return { dispose: vi.fn() };
    });

    await showExecutablePathQuickPick();

    expect(window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('OpenCode executable cleared'),
    );
  });

  it('persists the chosen file path via setConfiguration when the user picks one', async () => {
    // Regression: when the user picks a file from the open dialog, the
    // selection must be persisted to opencode.executablePath so the next
    // activation uses the new value. The persisted value is the native
    // fsPath (no URI conversion), preserving backslashes on Windows.
    const mock = createMockQuickPick();
    vi.mocked(window.createQuickPick).mockReturnValue(
      mock.qp as unknown as ReturnType<typeof window.createQuickPick>,
    );

    // Simulate the user selecting "Browse..." then picking a file
    mock.qp.onDidAccept.mockImplementation((cb: () => void) => {
      // Mock the user having selected the first item ("Browse...")
      mock.qp.selectedItems = [mock.qp.items[0]] as never;
      cb();
      return { dispose: vi.fn() };
    });
    mock.qp.onDidHide.mockImplementation((cb: () => void) => {
      void cb;
      return { dispose: vi.fn() };
    });
    mock.qp.onDidTriggerButton.mockReturnValue({ dispose: vi.fn() });

    const pickedUri = {
      scheme: 'file',
      fsPath: '/custom/bin/opencode',
    } as never;
    vi.mocked(window.showOpenDialog).mockResolvedValueOnce([pickedUri]);

    const workspaceMock = vi.mocked(workspace.getConfiguration);
    const updateMock = vi.fn();
    workspaceMock.mockReturnValue({
      get: vi.fn((key: string, defaultValue: unknown) =>
        key === 'executablePath' ? '' : defaultValue,
      ),
      update: updateMock,
    } as unknown as ReturnType<typeof workspace.getConfiguration>);

    await showExecutablePathQuickPick();

    expect(window.showOpenDialog).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith('executablePath', '/custom/bin/opencode', true);
  });

  it('does not call setConfiguration when the user cancels the file dialog', async () => {
    // Regression: dismissing the open dialog (returning undefined) must not
    // accidentally clear or overwrite the configured path.
    const mock = createMockQuickPick();
    vi.mocked(window.createQuickPick).mockReturnValue(
      mock.qp as unknown as ReturnType<typeof window.createQuickPick>,
    );
    mock.qp.onDidAccept.mockImplementation((cb: () => void) => {
      mock.qp.selectedItems = [mock.qp.items[0]] as never;
      cb();
      return { dispose: vi.fn() };
    });
    mock.qp.onDidHide.mockImplementation((cb: () => void) => {
      void cb;
      return { dispose: vi.fn() };
    });
    mock.qp.onDidTriggerButton.mockReturnValue({ dispose: vi.fn() });

    vi.mocked(window.showOpenDialog).mockResolvedValueOnce(undefined);

    const workspaceMock = vi.mocked(workspace.getConfiguration);
    const updateMock = vi.fn();
    workspaceMock.mockReturnValue({
      get: vi.fn().mockReturnValue(''),
      update: updateMock,
    } as unknown as ReturnType<typeof workspace.getConfiguration>);

    await showExecutablePathQuickPick();

    expect(updateMock).not.toHaveBeenCalled();
  });
});
