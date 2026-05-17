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

## Commands

```sh
npm run typecheck     # tsc --noEmit
npm run build         # webview + extension (prod)
npm run dev:webview   # Vite dev server for webview only
npm run lint          # run lint check
```

## Architecture Notes

- Single `SDKClient` instance reused for all sessions
- SSE events routed by `sessionID` in `event.properties`
- Extension host manages SSE subscription; webview receives via IPC (`event:received`)
- `src/shared/types.ts` contains IPC message types used by both sides

## Key Dependencies

- `@opencode-ai/sdk` — server communication
- `@vscode/webview-ui-toolkit` — VS Code styled components
- `zustand` — webview state management
- `react` 18 — webview UI

## Webview Styling & Design

- All webview UI development MUST strictly adhere to the tokens and specifications defined in [DESIGN.md](DESIGN.md).
- Prioritize using official `@vscode/webview-ui-toolkit` components to ensure a native look and feel.
- Never use hardcoded colors or sizes for UI layout elements in stylesheets. Always bind them to native VS Code CSS variables (e.g., `var(--vscode-editor-background)`, `var(--vscode-editor-foreground)`) to guarantee robust, automatic adaptation when the user switches VS Code themes.
