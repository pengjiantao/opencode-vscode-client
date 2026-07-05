/**
 * @file Regression tests for message part CSS theme adaptability.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readPartsStyles(): string {
  return readFileSync(resolve(process.cwd(), 'src/webview/styles/parts.css'), 'utf8');
}

function getCssRuleBody(css: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 'm').exec(css)?.[1] ?? '';
}

describe('Part styles', () => {
  it('regression: reasoning timeline dot uses theme-aware foreground instead of fixed white', () => {
    const css = readPartsStyles();
    const reasoningDotRule = getCssRuleBody(css, '.timeline-dot.reasoning-dot');
    const runningReasoningDotRule = getCssRuleBody(
      css,
      '.timeline-dot.reasoning-dot.status-running',
    );

    expect(reasoningDotRule).toMatch(/background-color:\s*var\(\s*--vscode-descriptionForeground,/);
    expect(reasoningDotRule).toContain('--webview-foreground');
    expect(reasoningDotRule).not.toMatch(/background-color:\s*(?:#fff(?:fff)?|white)\b/i);
    expect(runningReasoningDotRule).not.toMatch(/background-color:\s*(?:#fff(?:fff)?|white)\b/i);
  });
});
