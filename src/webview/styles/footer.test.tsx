/**
 * @file Regression tests for prompt input footer CSS theme adaptability.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readFooterStyles(): string {
  return readFileSync(resolve(process.cwd(), 'src/webview/styles/footer.css'), 'utf8');
}

function getCssRuleBody(css: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 'm').exec(css)?.[1] ?? '';
}

describe('Footer styles', () => {
  it('regression: cost metric default text uses theme foreground instead of fixed status-bar white', () => {
    const css = readFooterStyles();
    const costRule = getCssRuleBody(css, '.metadata-item.cost');

    expect(costRule).toMatch(/color:\s*var\(\s*--vscode-descriptionForeground,/);
    expect(costRule).toContain('--webview-foreground');
    expect(costRule).not.toContain('--vscode-statusBarItem-warningForeground');
    expect(costRule).not.toMatch(/color:\s*(?:#fff(?:fff)?|white)\b/i);
  });
});
