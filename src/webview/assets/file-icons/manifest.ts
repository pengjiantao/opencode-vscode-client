/**
 * @file Auto-generated URL map for the curated Material Icon Theme SVG subset.
 *
 * Vite resolves each `?url` import at build time and produces a hashed URL.
 * The icons themselves are vendored from
 * https://github.com/material-extensions/vscode-material-icon-theme (MIT).
 *
 * To add a new icon: copy the SVG into ./icons/ and add an entry to
 * `EXTENSION_ICON_MAP` / `FILENAME_ICON_MAP` in `src/webview/utils/file-icons.ts`.
 */

/// <reference types="vite/client" />

// Vite's typed glob import. The `?url` query guarantees each value is a
// string at build time, but the type system only exposes it as `unknown`,
// so we map to the strongly-typed shape below.
const modules = import.meta.glob('./icons/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});

/** Map from "typescript.svg" → built asset URL. */
export const FILE_ICON_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(modules).map(([k, v]) => [k.replace(/^.*\/([^/]+)\.svg$/, '$1.svg'), v as string]),
);
