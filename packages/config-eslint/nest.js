import globals from 'globals';

import {
  clockSyntax,
  moneySyntax,
  pollingGlobals,
  pollingSyntax,
  restrictedImports,
  restrictedSyntax,
  unsafeSqlSyntax,
} from './restricted.js';

/** Flat config for the NestJS API. `root` is the app folder relative to the repo. */
export function nestConfig(root) {
  return [
    {
      files: [`${root}/**/*.ts`],
      languageOptions: { globals: { ...globals.node } },
      rules: {
        'no-restricted-imports': ['error', restrictedImports({ banIoredis: true })],
        // Nest modules are empty classes carrying a @Module decorator; anything else stays flagged.
        '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      },
    },
    {
      files: [`${root}/src/infrastructure/**/*.ts`, `${root}/test/**/*.ts`],
      rules: { 'no-restricted-imports': ['error', restrictedImports()] },
    },
    {
      // Money and time discipline in business code (CODING_STANDARDS.md §5).
      files: [
        `${root}/src/modules/**/application/**/*.ts`,
        `${root}/src/modules/{sales,customers,vendors,reporting}/**/*.ts`,
      ],
      ignores: [`${root}/**/*.spec.ts`],
      rules: {
        'no-restricted-syntax': restrictedSyntax(
          pollingSyntax,
          unsafeSqlSyntax,
          moneySyntax,
          clockSyntax,
        ),
      },
    },
    {
      // The API's only timer helper (sleep used by retry/backoff).
      files: [`${root}/src/common/time/**/*.ts`],
      rules: {
        'no-restricted-globals': ['error', pollingGlobals[0]],
        'no-restricted-syntax': restrictedSyntax(pollingSyntax.slice(0, 3), unsafeSqlSyntax),
        'no-restricted-imports': ['error', restrictedImports({ allowTimers: true })],
      },
    },
  ];
}
