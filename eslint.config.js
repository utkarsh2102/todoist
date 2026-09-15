import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default defineConfig(
  {
    ignores: ['**/dist/**', '**/.data/**', 'coverage/**', 'apps/api/src/db/migrations/**'],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    extends: [reactHooks.configs.flat.recommended],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'Raw HTML is not allowed (XSS). Render Markdown through lib/markdown.tsx.',
        },
      ],
    },
  },
  {
    files: ['apps/api/**/*.ts', 'scripts/**/*.ts', 'netlify/**/*.mts', '*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    // Architecture boundary (docs/plan-v1.md, section A): domain code depends only on ports,
    // never on HTTP, adapters or vendor SDKs.
    files: ['apps/api/src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/adapters/**', '**/http/**'],
              message: 'core/ must not import adapters/ or http/ — depend on a port in ports/.',
            },
            {
              group: [
                'hono',
                'hono/*',
                '@hono/*',
                'web-push',
                'googleapis',
                'google-auth-library',
                'openid-client',
                '@libsql/*',
              ],
              message: 'core/ must not import HTTP frameworks or vendor SDKs — use a port.',
            },
          ],
        },
      ],
    },
  },
);
