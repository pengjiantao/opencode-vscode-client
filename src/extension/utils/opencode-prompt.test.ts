/**
 * @file Unit tests for opencode-prompt.ts.
 * Verifies the recovery prompt builds the right message, exposes the right
 * action labels, and dispatches each action to the correct VS Code API.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { commands, env, Uri, window } from 'vscode';
import { buildPromptContent, getPromptActions, showOpencodeNotFoundPrompt } from './opencode-prompt';

describe('opencode-prompt', () => {
  describe('getPromptActions', () => {
    it('exposes four action buttons in the expected order', () => {
      const actions = getPromptActions();
      expect(actions).toEqual([
        'Open Settings',
        'Copy install command',
        'Open install docs',
        'Retry',
      ]);
    });
  });

  describe('buildPromptContent', () => {
    it('produces a reason-specific detail for not-in-path', () => {
      const detail = buildPromptContent({
        path: null,
        source: 'none',
        reason: 'not-in-path',
      });
      expect(detail).toContain("Could not find the 'opencode' executable");
      expect(detail).toContain('opencode.executablePath');
    });

    it('includes the configured path in the detail for config-invalid', () => {
      const detail = buildPromptContent({
        path: null,
        source: 'none',
        reason: 'config-invalid',
        configuredPath: '/bad/path',
      });
      expect(detail).toContain('/bad/path');
      expect(detail).toContain('does not exist');
    });
  });

  describe('showOpencodeNotFoundPrompt', () => {
    // window.showErrorMessage is overloaded with both string items and MessageItem items.
    // We only ever pass strings, so cast the mock to the string-accepting signature.
    const showErrorMessageMock = window.showErrorMessage as unknown as ReturnType<typeof vi.fn>;

    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    const noneResult = {
      path: null,
      source: 'none' as const,
      reason: 'not-in-path' as const,
    };

    it('shows an error message with the right title and detail', async () => {
      showErrorMessageMock.mockResolvedValueOnce(undefined);

      await showOpencodeNotFoundPrompt(noneResult);

      expect(showErrorMessageMock).toHaveBeenCalledTimes(1);
      const [detailArg, optionsArg, ...actions] = showErrorMessageMock.mock.calls[0] as [
        string,
        { modal: boolean },
        ...string[],
      ];
      expect(detailArg).toContain("Could not find the 'opencode' executable");
      expect(optionsArg.modal).toBe(false);
      expect(actions).toEqual(getPromptActions());
    });

    it('logs the underlying error to the console for diagnostics', async () => {
      showErrorMessageMock.mockResolvedValueOnce(undefined);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await showOpencodeNotFoundPrompt(noneResult, new Error('spawn opencode ENOENT'));

      expect(errorSpy).toHaveBeenCalledWith(
        '[opencode] binary resolution failed:',
        expect.objectContaining({ message: 'spawn opencode ENOENT' }),
      );
    });

    it('does not throw when showErrorMessage rejects (e.g. in headless tests)', async () => {
      showErrorMessageMock.mockRejectedValueOnce(new Error('boom'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(showOpencodeNotFoundPrompt(noneResult)).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(
        '[opencode] failed to display not-found prompt:',
        expect.any(Error),
      );
    });

    it('opens the opencode.executablePath setting when the user picks "Open Settings"', async () => {
      showErrorMessageMock.mockResolvedValueOnce('Open Settings');

      await showOpencodeNotFoundPrompt(noneResult);

      expect(commands.executeCommand).toHaveBeenCalledWith(
        'workbench.action.openSettings',
        'opencode.executablePath',
      );
    });

    it('copies the install command to the clipboard when the user picks "Copy install command"', async () => {
      showErrorMessageMock.mockResolvedValueOnce('Copy install command');
      vi.mocked(window.showInformationMessage).mockResolvedValueOnce(undefined);

      await showOpencodeNotFoundPrompt(noneResult);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(env.clipboard.writeText).toHaveBeenCalledWith(
        'curl -fsSL https://opencode.ai/install | bash',
      );
    });

    it('opens the install docs in the user browser when the user picks "Open install docs"', async () => {
      showErrorMessageMock.mockResolvedValueOnce('Open install docs');

      await showOpencodeNotFoundPrompt(noneResult);

      expect(env.openExternal).toHaveBeenCalledTimes(1);
      const uriArg = (env.openExternal as ReturnType<typeof vi.fn>).mock.calls[0][0] as Uri;
      expect(uriArg.toString()).toContain('https://opencode.ai/docs/');
    });

    it('reloads the VS Code window when the user picks "Retry"', async () => {
      showErrorMessageMock.mockResolvedValueOnce('Retry');

      await showOpencodeNotFoundPrompt(noneResult);

      expect(commands.executeCommand).toHaveBeenCalledWith('workbench.action.reloadWindow');
    });

    it('does nothing extra when the user dismisses the notification', async () => {
      showErrorMessageMock.mockResolvedValueOnce(undefined);

      await showOpencodeNotFoundPrompt(noneResult);

      expect(commands.executeCommand).not.toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(env.clipboard.writeText).not.toHaveBeenCalled();
      expect(env.openExternal).not.toHaveBeenCalled();
    });

    it('logs and swallows errors from the action handler', async () => {
      showErrorMessageMock.mockResolvedValueOnce('Open Settings');
      vi.mocked(commands.executeCommand).mockRejectedValueOnce(new Error('cmd failed'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await showOpencodeNotFoundPrompt(noneResult);

      expect(errorSpy).toHaveBeenCalledWith(
        '[opencode] failed to handle prompt action "Open Settings":',
        expect.any(Error),
      );
    });
  });
});
