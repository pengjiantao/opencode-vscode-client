/**
 * @file Regression tests for global tooltip CSS theme adaptability.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readTooltipStyles(): string {
  return readFileSync(resolve(process.cwd(), 'src/webview/styles/tooltip.css'), 'utf8');
}

function getCssRuleBody(css: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 'm').exec(css)?.[1] ?? '';
}

describe('Tooltip styles', () => {
  it('regression: tooltip container uses an opaque VS Code widget surface in light themes', () => {
    const css = readTooltipStyles();
    const containerRule = getCssRuleBody(css, '.custom-tooltip-container');

    // VS Code exposes editorWidget.* as camel-cased custom properties in webviews.
    expect(containerRule).toMatch(/background-color:\s*var\(\s*--vscode-editorWidget-background,/);
    expect(containerRule).toContain('--vscode-editor-background');
    expect(containerRule).toMatch(/(?:^|\n)\s*color:\s*var\(\s*--vscode-editorWidget-foreground,/);

    // A translucent overlay lets editor content show through and makes light themes unreadable.
    expect(containerRule).not.toMatch(/background-color:\s*color-mix\([^;]*transparent/s);
    expect(css).not.toContain('backdrop-filter');
    expect(css).not.toMatch(/@supports\s*\(\s*backdrop-filter/);
  });
});
