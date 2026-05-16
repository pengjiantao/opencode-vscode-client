import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup/webview.ts'],
    include: ['src/webview/**/*.test.tsx', 'test/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage/webview',
      include: ['src/webview/**/*.{ts,tsx}'],
      exclude: ['**/*.test.ts', 'test/**'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/webview'),
    },
  },
});
