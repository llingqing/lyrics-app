import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: [
      '**/dist/',
      '**/dist-electron/',
      'release/',
      'coverage/',
      'node_modules/',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Project-wide rules
  {
    rules: {
      // Every `any` was removed from src/ and electron/ — keep it that way
      '@typescript-eslint/no-explicit-any': 'error',
      // `require('fs')` returns any and defeats type inference (see 29d6379)
      '@typescript-eslint/no-require-imports': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        caughtErrors: 'none',
      }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  // Renderer process — browser environment, React
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Fetch-on-mount calls an async function, so setState lands in a
      // microtask rather than synchronously. The rule can't see that.
      'react-hooks/set-state-in-effect': 'warn',
      // The renderer runs with nodeIntegration: false — importing a node
      // builtin here builds fine but blanks the window at runtime.
      'no-restricted-imports': ['error', {
        paths: [
          'path', 'fs', 'os', 'crypto', 'child_process', 'util', 'stream',
          'http', 'https', 'net', 'url', 'zlib', 'events', 'buffer',
        ].map(name => ({ name, message: 'Node builtins are unavailable in the renderer process.' })),
        patterns: ['node:*'],
      }],
    },
  },

  // Main process — node environment
  {
    files: ['electron/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Tests — vitest globals; assertions legitimately pass `any` to probe types
  {
    files: ['tests/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
)