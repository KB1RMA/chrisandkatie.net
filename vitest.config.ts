import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [],
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    css: false,
    // Extend Vitest's built-in excludes rather than replacing them, so that
    // generated directories (.next, .open-next, etc.) are still ignored.
    // Adds exclusion for Playwright E2E specs — run via `npm run test:e2e`.
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
    reporters: process.env.GITHUB_ACTIONS
      ? ['default', 'github-actions', 'junit']
      : ['default', 'junit'],
    outputFile: {
      junit: './test-reports/junit.xml',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        '.next/',
        '.open-next/',
        'out/',
        'build/',
        '**/*.config.{js,ts}',
        '**/types.ts',
        '**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      // workerd-only module — stubbed so Durable Objects are unit-testable
      'cloudflare:workers': path.resolve(
        __dirname,
        './tests/stubs/cloudflare-workers.ts',
      ),
      '@': path.resolve(__dirname, './src'),
    },
  },
});
