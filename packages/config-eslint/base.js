import js from '@eslint/js';
import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import importX from 'eslint-plugin-import-x';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import {
  pollingGlobals,
  pollingSyntax,
  restrictedImports,
  restrictedSyntax,
  unsafeSqlSyntax,
} from './restricted.js';

const PROTECTED_RULES = [
  'no-restricted-globals',
  'no-restricted-syntax',
  'max-lines',
  '@typescript-eslint/no-explicit-any',
  '@typescript-eslint/ban-ts-comment',
];

export const ignores = {
  ignores: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.next/**',
    '**/.next-e2e/**',
    '**/playwright-report/**',
    '**/test-results/**',
    '**/.turbo/**',
    '**/coverage/**',
    '**/__generated__/**',
    'packages/database/src/generated/**',
    '**/next-env.d.ts',
    'Screen Shots/**',
  ],
};

const coreRules = {
  'no-console': 'error',
  'max-lines': ['error', { max: 200, skipBlankLines: false, skipComments: false }],
  complexity: ['warn', 15],
  'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true }],
  'no-restricted-globals': ['error', ...pollingGlobals],
  'no-restricted-syntax': restrictedSyntax(pollingSyntax, unsafeSqlSyntax),
  'no-restricted-imports': ['error', restrictedImports()],
  '@typescript-eslint/consistent-type-imports': 'error',
  '@typescript-eslint/ban-ts-comment': [
    'error',
    { 'ts-ignore': true, 'ts-nocheck': true, 'ts-expect-error': true },
  ],
  '@eslint-community/eslint-comments/require-description': 'error',
  '@eslint-community/eslint-comments/no-unlimited-disable': 'error',
  '@eslint-community/eslint-comments/no-restricted-disable': ['error', ...PROTECTED_RULES],
  'import-x/order': [
    'error',
    {
      groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
      pathGroups: [
        { pattern: '@pos/**', group: 'internal', position: 'before' },
        { pattern: '@/**', group: 'internal' },
      ],
      pathGroupsExcludedImportTypes: ['type'],
      'newlines-between': 'always',
      alphabetize: { order: 'asc', caseInsensitive: true },
    },
  ],
};

const testRules = {
  '@typescript-eslint/ban-ts-comment': [
    'error',
    {
      'ts-ignore': true,
      'ts-nocheck': true,
      'ts-expect-error': 'allow-with-description',
      minimumDescriptionLength: 10,
    },
  ],
  'max-lines-per-function': 'off',
};

/** Base flat config for every workspace package. */
export function baseConfig() {
  return [
    ignores,
    js.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    comments.recommended,
    {
      languageOptions: {
        parserOptions: { projectService: true },
        globals: { ...globals.es2024 },
      },
      plugins: { 'import-x': importX },
      rules: coreRules,
    },
    {
      files: ['**/*.{spec,test}.{ts,tsx}', '**/test/**/*.ts', 'e2e/**/*.ts'],
      rules: testRules,
    },
    {
      // Repository scripts, package CLIs and tools are not application code: they may log
      // and wait for services to start. setInterval stays banned (check:no-polling).
      files: [
        'scripts/**/*.ts',
        'tools/**/*.ts',
        'packages/*/scripts/**/*.ts',
        'apps/api/src/cli/**/*.ts',
      ],
      languageOptions: { globals: { ...globals.node } },
      rules: {
        'no-console': 'off',
        'no-restricted-globals': ['error', pollingGlobals[0]],
        'no-restricted-imports': ['error', restrictedImports({ allowTimers: true })],
      },
    },
    { files: ['**/*.{js,mjs,cjs}'], ...tseslint.configs.disableTypeChecked },
    {
      files: ['**/*.{js,mjs,cjs}'],
      languageOptions: { globals: { ...globals.node } },
    },
  ];
}
