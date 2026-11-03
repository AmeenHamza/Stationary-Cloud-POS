// Restriction groups shared by every ESLint config (CODING_STANDARDS.md §5, §6).
// `no-restricted-syntax` is replaced (not merged) by later configs, so callers
// always compose the full set they need with `restrictedSyntax(...)`.

export const pollingGlobals = [
  { name: 'setInterval', message: 'Polling is banned (CODING_STANDARDS.md §6).' },
  { name: 'setTimeout', message: 'Use lib/timing (web) or common/time (api) helpers.' },
];

export const pollingSyntax = [
  { selector: "Property[key.name='pollInterval']", message: 'Apollo polling is banned.' },
  {
    selector: "CallExpression[callee.property.name='startPolling']",
    message: 'Apollo polling is banned.',
  },
  { selector: "Property[key.name='refetchInterval']", message: 'Periodic refetch is banned.' },
  {
    selector: 'CallExpression[callee.property.name=/^(setInterval|setTimeout)$/]',
    message: 'Use the timing helpers instead of timers.',
  },
];

export const unsafeSqlSyntax = [
  {
    selector: 'MemberExpression[property.name=/^\\$(queryRawUnsafe|executeRawUnsafe)$/]',
    message: 'Unsafe raw SQL is banned; use TypedSQL or tagged $queryRaw.',
  },
];

export const moneySyntax = [
  { selector: "CallExpression[callee.name='parseFloat']", message: 'Use Decimal for money.' },
  { selector: "CallExpression[callee.name='Number']", message: 'Use Decimal for money.' },
  { selector: "CallExpression[callee.property.name='toFixed']", message: 'Use Decimal for money.' },
];

export const clockSyntax = [
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message: 'Use ClockService (api) or pass the time in (domain).',
  },
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message: 'Use ClockService (api) or pass the time in (domain).',
  },
];

/** Builds a complete `no-restricted-syntax` rule entry from groups. */
export function restrictedSyntax(...groups) {
  return ['error', ...groups.flat()];
}

const TIMER_MODULES = ['timers', 'timers/promises', 'node:timers', 'node:timers/promises'];

/**
 * Builds a complete `no-restricted-imports` rule options object.
 * Timer modules are banned (they would bypass the setTimeout/setInterval ban)
 * except in the timing helpers, scripts and tools.
 */
export function restrictedImports({ allowTimers = false, banIoredis = false } = {}) {
  const paths = [
    { name: 'lodash', message: 'No generic utility grab-bags; write a focused helper.' },
  ];
  if (!allowTimers) {
    for (const name of TIMER_MODULES) {
      paths.push({ name, message: 'Timers only via lib/timing (web) or common/time (api).' });
    }
  }
  if (banIoredis) {
    paths.push({ name: 'ioredis', message: 'Redis is only used through src/infrastructure.' });
  }
  return {
    paths,
    patterns: [
      {
        group: ['@prisma/client', '@prisma/client/*'],
        message: 'Import the Prisma client from @pos/database.',
      },
    ],
  };
}
