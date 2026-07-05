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

  it('regression: bash output details use light-theme-safe VS Code color tokens', () => {
    const css = readPartsStyles();
    const containerRule = getCssRuleBody(css, '.tool-bash-output');
    const headerRule = getCssRuleBody(css, '.bash-output-header');
    const promptRule = getCssRuleBody(css, '.bash-output-prompt');
    const scrollContainerRule = getCssRuleBody(css, '.bash-output-scroll-container');
    const outputRule = getCssRuleBody(css, '.bash-output-scroll pre');

    expect(containerRule).toContain('--bash-output-background: var(');
    expect(containerRule).toContain('--vscode-terminal-background');
    expect(containerRule).toContain('--vscode-textCodeBlock-background');
    expect(containerRule).toContain('--webview-background');
    expect(containerRule).toMatch(/background-color:\s*var\(\s*--bash-output-background\s*\)/);
    expect(containerRule).toMatch(/color:\s*var\(\s*--bash-output-foreground\s*\)/);

    expect(headerRule).toContain('var(--bash-output-background)');
    expect(headerRule).toContain('--webview-foreground');
    expect(promptRule).toMatch(
      /color:\s*var\(\s*--vscode-terminal-ansiGreen,\s*var\(\s*--vscode-textLink-foreground\s*\)\s*\)/,
    );
    expect(scrollContainerRule).toMatch(
      /--scroll-fade-color:\s*var\(\s*--bash-output-background\s*\)/,
    );
    expect(scrollContainerRule).toMatch(
      /background-color:\s*var\(\s*--bash-output-background\s*\)/,
    );
    expect(outputRule).toMatch(/color:\s*var\(\s*--bash-output-foreground\s*\)/);
    expect(outputRule).not.toContain('opacity');

    expect(containerRule + headerRule + promptRule + scrollContainerRule + outputRule).not.toMatch(
      /#121212|#000(?:000)?|#ccc(?:ccc)?|\bblack\b/i,
    );
  });
});
