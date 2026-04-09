const prettierConfig = require('eslint-config-prettier');
const prettierPlugin = require('eslint-plugin-prettier');
const tseslint = require('typescript-eslint');
const testingLibraryPlugin = require('eslint-plugin-testing-library');
const vitestPlugin = require('@vitest/eslint-plugin');
const playwrightPlugin = require('eslint-plugin-playwright');

const eslintConfig = [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/.open-next/**',
      '**/.wrangler/**',
      '**/out/**',
      '**/build/**',
      '**/prisma/generated/**',
      '**/src/generated/**',
      '**/coverage/**',
      '**/test-reports/**',
      '**/test-results/**',
    ],
  },
  prettierConfig,
  {
    files: [
      'src/**/*.{js,mjs,cjs}',
      'scripts/**/*.{js,mjs,cjs}',
      '*.{js,mjs,cjs}',
    ],
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'error',
      'padding-line-between-statements': [
        'error',
        {
          blankLine: 'always',
          prev: '*',
          next: 'block-like',
        },
        {
          blankLine: 'always',
          prev: 'block-like',
          next: '*',
        },
        {
          blankLine: 'always',
          prev: '*',
          next: 'return',
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'scripts/**/*.ts', '*.ts', '*.tsx'],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      prettier: prettierPlugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        sourceType: 'module',
        ecmaVersion: 'latest',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      'prettier/prettier': 'error',
      'padding-line-between-statements': [
        'error',
        {
          blankLine: 'always',
          prev: '*',
          next: 'block-like',
        },
        {
          blankLine: 'always',
          prev: 'block-like',
          next: '*',
        },
        {
          blankLine: 'always',
          prev: '*',
          next: 'return',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': 'allow-with-description',
          minimumDescriptionLength: 10,
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
    },
  },
  {
    // Vitest + Testing Library rules scoped to src/ unit/component tests only.
    // tests/e2e/ is handled separately below.
    files: ['src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'testing-library': testingLibraryPlugin,
      vitest: vitestPlugin,
      prettier: prettierPlugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        sourceType: 'module',
        ecmaVersion: 'latest',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...vitestPlugin.environments.env.globals,
      },
    },
    rules: {
      'prettier/prettier': 'error',
      ...testingLibraryPlugin.configs['flat/react'].rules,
      ...vitestPlugin.configs.recommended.rules,
      'testing-library/prefer-screen-queries': 'error',
      'testing-library/no-wait-for-multiple-assertions': 'error',
      'vitest/expect-expect': 'error',
      'vitest/no-disabled-tests': 'warn',
      'vitest/no-focused-tests': 'error',
      'vitest/prefer-to-be': 'error',
      'vitest/prefer-to-have-length': 'error',
    },
  },
  {
    // Playwright rules for E2E tests.
    files: ['tests/e2e/**/*.{ts,tsx}'],
    plugins: {
      playwright: playwrightPlugin,
      '@typescript-eslint': tseslint.plugin,
      prettier: prettierPlugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        sourceType: 'module',
        ecmaVersion: 'latest',
      },
    },
    rules: {
      'prettier/prettier': 'error',
      ...playwrightPlugin.configs['flat/recommended'].rules,
      // Disallow test.only left in committed code.
      'playwright/no-focused-test': 'error',
      // Disallow skipped tests without a comment explaining why.
      'playwright/no-skipped-test': 'warn',
      // Catch missing awaits on async Playwright calls.
      'playwright/no-floating-promises': 'off',
      // Prefer built-in Playwright assertions over raw expect(x).toBe().
      'playwright/prefer-web-first-assertions': 'error',
      // Disallow page.pause() — it blocks CI.
      'playwright/no-page-pause': 'error',
      // Encourage waiting via expect() rather than explicit waits.
      'playwright/no-wait-for-timeout': 'warn',
    },
  },
];

module.exports = eslintConfig;
