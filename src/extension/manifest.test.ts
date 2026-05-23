/**
 * @file Regression tests for VS Code contribution manifest keyboard shortcut scopes.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

interface KeybindingContribution {
  command: string;
  key?: string;
  mac?: string;
  when?: string;
}

interface PackageManifest {
  contributes?: {
    keybindings?: KeybindingContribution[];
  };
}

function readPackageManifest(): PackageManifest {
  const manifestText = readFileSync(resolve(process.cwd(), 'package.json'), 'utf8');
  return JSON.parse(manifestText) as PackageManifest;
}

describe('Package contribution manifest', () => {
  it('regression: scopes paste-as-plain-text shortcut to the active webview panel', () => {
    const manifest = readPackageManifest();
    const keybinding = manifest.contributes?.keybindings?.find(
      (item) => item.command === 'opencode-sidebar.pasteAsPlainText',
    );

    expect(keybinding).toMatchObject({
      key: 'ctrl+shift+v',
      mac: 'cmd+shift+v',
      when: "activeWebviewPanelId == 'opencode-sidebar.main'",
    });
    expect(keybinding?.when).not.toContain('webviewId');
    expect(keybinding?.when).not.toContain('focusedView');
  });
});
