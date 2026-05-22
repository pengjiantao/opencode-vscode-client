# Agent Instructions

## Build System

- **Webview**: Vite (`npm run dev:webview` for hot-reload dev)
- **Extension host**: TypeScript + esbuild (NOT Vite)
- Build order matters: `npm run build` runs `build:webview` then `build:extension`
- Extension entry: `src/extension/index.ts` (not Vite-managed)

## TypeScript Configs

- `tsconfig.json` — webview code (includes `src/webview/**/*`)
- `tsconfig.extension.json` — extension host (includes `src/extension/**/*`)

## Testing

- Extension tests: `npm run test:extension` (uses `vitest.config.extension.ts`)
- Webview tests: `npm run test:webview` (uses `vitest.config.webview.ts`)
- Full test suite: `npm run test` (runs both)
- Webview tests use jsdom with `@testing-library/jest-dom` and a setup file (`test/setup/webview.ts`) that mocks `acquireVsCodeApi`
- `npm run test:watch` only watches webview tests
- **Regression Testing Rule**: Every time a bug is fixed, a corresponding regression test **MUST** be added to cover the specific problem-triggering scenario in the appropriate test suite to prevent recurrences.

## Commands

```sh
npm run build         # webview + extension (prod)
npm run dev:webview   # Vite dev server for webview only
npm run lint          # run lint check
```

## Architecture Notes

- Single `SDKClient` instance reused for all sessions
- SSE events routed by `sessionID` in `event.properties`
- Extension host manages SSE subscription; webview receives via IPC (`event:received`)
- `src/shared/types.ts` contains IPC message types used by both sides
- `src/extension/utils/config.ts` provides strongly-typed configuration settings retrieval

## External Source Code References

- **Opencode Source Repository**: The complete `opencode` backend monorepo source code is cloned in the parent directory at `../opencode` (absolute path: `/home/fiyqkrc/Documents/project/opencode`). When debugging backend interactions, understanding service behaviors, verifying API endpoints, or clarifying complex specifications, the AI **MUST** read and analyze the raw codebase in `../opencode` to ensure total correctness.

## Key Dependencies

- `@opencode-ai/sdk` — server communication
- `@vscode/webview-ui-toolkit` — VS Code styled components
- `zustand` — webview state management
- `react` 18 — webview UI

## Webview Styling & Design

- All webview UI development MUST strictly adhere to the tokens and specifications defined in [DESIGN.md](DESIGN.md).
- Prioritize using official `@vscode/webview-ui-toolkit` components to ensure a native look and feel.
- Never use hardcoded colors or sizes for UI layout elements in stylesheets. Always bind them to native VS Code CSS variables (e.g., `var(--vscode-editor-background)`, `var(--vscode-editor-foreground)`) to guarantee robust, automatic adaptation when the user switches VS Code themes.

## Coding Standards & Guidelines

- **File Length Limitation**: A single file MUST NOT exceed 500 lines of code. If a file exceeds this limit, it must be refactored, split into smaller focused files, and its overall structure optimized.
- **Strict Typing System**: Maintain a robust, global strong typing system. The use of `any` is strictly prohibited under all circumstances. Ensure all objects, parameters, and return types are explicitly typed or properly inferred.
- **No Code Duplication**: Large block replication or copy-pasting of code is strictly prohibited. Identify duplicate or shared logic and proactively extract them into utility helper classes or reusable common React/VS Code components.
- **Commenting Requirements**: Every source file MUST include a `@file` JSDoc comment at the top describing the module's purpose. Every exported function, class, interface, and type MUST have a JSDoc doc comment explaining its purpose and contract (`/** ... */`). Key logic blocks (e.g., complex conditionals, non-obvious data transformations, workarounds, performance considerations) MUST be accompanied by inline comments. Comments must explain _why_ not _what_ — the code itself says what it does. Redundant or noise comments (e.g., `// increment i` for `i++`) are prohibited.
