import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  root: 'src/webview',
  base: './',
  build: {
    outDir: '../../dist/webview',
    emptyOutDir: true,
    // Inline every asset as a data URI. The webview host replaces
    // <script type="module"> with <script defer> (see webview-html.ts),
    // which strips the ES-module context where `import.meta.url` lives.
    // Any `new URL(..., import.meta.url)` would then throw at runtime
    // and leave the side panel empty, so we keep all assets as data URIs
    // to avoid that code path entirely.
    assetsInlineLimit: 100 * 1024 * 1024,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/webview'),
    },
  },
});
