import { defineConfig } from 'eslint/config';

import { baseConfig } from '@pos/config-eslint/base';
import { nestConfig } from '@pos/config-eslint/nest';
import { nextConfig } from '@pos/config-eslint/next';
import {
  clockSyntax,
  moneySyntax,
  pollingSyntax,
  restrictedSyntax,
  unsafeSqlSyntax,
} from '@pos/config-eslint/restricted';

export default defineConfig(
  baseConfig(),
  nextConfig('apps/web'),
  nestConfig('apps/api'),
  {
    // @pos/domain is pure: money via Decimal, time passed in (CODING_STANDARDS.md §5).
    files: ['packages/domain/src/**/*.ts'],
    ignores: ['packages/domain/src/**/*.test.ts'],
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
    // The money module wraps Decimal itself (toFixed on Decimal is exact), so only the
    // polling, SQL and clock restrictions apply there.
    files: ['packages/domain/src/money/**/*.ts'],
    ignores: ['packages/domain/src/**/*.test.ts'],
    rules: {
      'no-restricted-syntax': restrictedSyntax(pollingSyntax, unsafeSqlSyntax, clockSyntax),
    },
  },
  {
    // The database package is the one place that wraps the generated Prisma client.
    files: ['packages/database/**/*.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
);
