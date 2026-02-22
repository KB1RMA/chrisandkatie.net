const nextConfig = require('eslint-config-next');
const prettierConfig = require('eslint-config-prettier');
const prettierPlugin = require('eslint-plugin-prettier');
const tseslint = require('typescript-eslint');
const reactHooks = require('eslint-plugin-react-hooks');

const eslintConfig = [
  {
    ignores: [
      '.next/**',
      '.open-next/**',
      'out/**',
      'build/**',
      'node_modules/**',
    ],
  },
  ...nextConfig,
  reactHooks.configs.flat.recommended,
  prettierConfig,
  {
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'error',
      // Forces a blank line prior to block elements and returns. Does
      //   a great job letting the reader breathe while reading code ;)
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
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        sourceType: 'module',
        project: './tsconfig.json',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
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
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
    },
  },
];

module.exports = eslintConfig;
