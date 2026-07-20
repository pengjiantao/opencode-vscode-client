# ADR-001: Use a Static markdown-it Token Renderer

## Status

Accepted

## Date

2026-07-20

## Context

The webview previously used a hand-written, line-oriented Markdown parser. It did not preserve nested inline structure, so ``**`cli`**`` lost the inline code node. Its table splitter also treated an unclosed backtick as a code span covering the rest of a row, collapsing all remaining columns.

The renderer must support CommonMark/GFM blocks and inline constructs while retaining OpenCode-specific file references and attachment chips. User-provided Markdown must not become raw HTML.

## Decision

Use `markdown-it` as a direct, static webview dependency with `html: false`, `linkify: false`, and `breaks: false`. Convert its tokens to a whitelisted React tree instead of generating HTML strings.

Retain custom file-reference and chip rendering only for parser text tokens. Normalize GFM table rows before tokenization to escape pipes inside complete backtick code spans. Invalid or incomplete delimiters are deliberately left unchanged so they cannot consume table borders.

Treat a document-start `---` block as YAML front matter only when it has a closing `---` or `...`; otherwise, parse the original text as ordinary Markdown.

## Alternatives Considered

### Retain the hand-written parser

Rejected because each additional Markdown interaction would require another stateful special case, and the parser had already failed on nested inline syntax and malformed table input.

### Dynamically import markdown-it

Rejected because Markdown is visible chat content and deferring its parser would introduce a loading state or an unparsed first paint. The webview host also rewrites the entry module to a deferred script, which makes additional module chunks a fragile runtime dependency. The production bundle changed from 209.17KB to 209.24KB gzip, so the measured 70B gzip increase does not justify that complexity.

### Render parser-generated HTML

Rejected because a React token renderer keeps untrusted input off the raw HTML path and integrates the existing interactive file-reference controls safely.

## Consequences

- CommonMark/GFM nesting, thematic breaks, and table structure are delegated to a maintained parser.
- `markdownTableNormalizer.ts` is intentionally narrow and has direct boundary tests for code spans, malformed delimiters, escaping, and fenced blocks.
- New Markdown extensions should be represented as parser tokens and rendered through the existing tag whitelist.
