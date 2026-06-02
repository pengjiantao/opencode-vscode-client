# File-type icons

This directory contains a curated subset of SVG icons vendored from
[**vscode-material-icon-theme**](https://github.com/material-extensions/vscode-material-icon-theme)
by Philipp Kief (PKief).

## License

The vendored SVG files are licensed under the **MIT License**.

Copyright (c) Philipp Kief

See <https://github.com/material-extensions/vscode-material-icon-theme/blob/main/LICENSE>
for the full license text.

## How icons are resolved

The icons are bundled at build time by Vite via `import.meta.glob` in
[`manifest.ts`](./manifest.ts). At runtime, `getFileIconName(filePath)` in
[`src/webview/utils/file-icons.ts`](../../utils/file-icons.ts) maps a file
extension or special filename to an icon name, which is then looked up in the
manifest to get the built asset URL.

## Adding a new icon

1. Download the SVG from
   <https://github.com/material-extensions/vscode-material-icon-theme/tree/main/icons>
   and drop it into `./icons/`.
2. Add a mapping entry in `EXTENSION_ICON_MAP` or `FILENAME_ICON_MAP` in
   `src/webview/utils/file-icons.ts` so the resolver can find it.
3. Run `npm run test:webview` to confirm the new mapping resolves correctly.
