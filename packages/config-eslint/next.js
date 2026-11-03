import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

import {
  pollingGlobals,
  pollingSyntax,
  restrictedImports,
  restrictedSyntax,
  unsafeSqlSyntax,
} from './restricted.js';

/** Flat config for the Next.js app. `root` is the app folder relative to the repo. */
export function nextConfig(root) {
  return [
    {
      files: [`${root}/**/*.{ts,tsx}`],
      plugins: { 'react-hooks': reactHooks, '@next/next': nextPlugin },
      languageOptions: { globals: { ...globals.browser } },
      rules: {
        ...reactHooks.configs.recommended.rules,
        ...nextPlugin.configs.recommended.rules,
        ...nextPlugin.configs['core-web-vitals'].rules,
      },
    },
    {
      // The only place allowed to schedule timers (debounce, backoff sleep).
      files: [`${root}/src/lib/timing/**/*.ts`],
      rules: {
        'no-restricted-globals': ['error', pollingGlobals[0]],
        'no-restricted-syntax': restrictedSyntax(pollingSyntax.slice(0, 3), unsafeSqlSyntax),
        'no-restricted-imports': ['error', restrictedImports({ allowTimers: true })],
      },
    },
  ];
}
