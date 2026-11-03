/**
 * Module boundary and cycle rules (CODING_STANDARDS.md §4, ARCHITECTURE.md §6).
 * Rule names are stable: CI prints them.
 */
const NPM = ['npm', 'npm-dev', 'npm-peer', 'npm-optional', 'npm-no-pkg', 'npm-unknown'];
const TESTS = '\\.(spec|test)\\.tsx?$|/test/|/__tests__/|^e2e/';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
    {
      name: 'web-not-to-server',
      severity: 'error',
      from: { path: '^apps/web' },
      to: { path: ['^apps/api', '^packages/database', '^tools'] },
    },
    {
      name: 'domain-is-pure',
      severity: 'error',
      from: { path: '^packages/domain/src' },
      to: { dependencyTypes: NPM, pathNot: 'node_modules/(decimal\\.js|date-fns|@date-fns/tz)/' },
    },
    {
      name: 'domain-workspace-deps',
      severity: 'error',
      from: { path: '^packages/domain/src' },
      to: { path: '^(apps|tools|packages/(?!domain|contracts))' },
    },
    {
      name: 'contracts-is-leaf',
      severity: 'error',
      from: { path: '^packages/contracts/src' },
      to: { path: '^(apps|tools|packages/(?!contracts))', dependencyTypesNot: ['core'] },
    },
    {
      name: 'contracts-no-npm',
      severity: 'error',
      from: { path: '^packages/contracts/src' },
      to: { dependencyTypes: NPM },
    },
    {
      name: 'validation-deps',
      severity: 'error',
      from: { path: '^packages/validation/src' },
      to: { dependencyTypes: NPM, pathNot: 'node_modules/zod/' },
    },
    {
      name: 'validation-workspace-deps',
      severity: 'error',
      from: { path: '^packages/validation/src' },
      to: { path: '^(apps|tools|packages/(?!validation|domain|contracts))' },
    },
    {
      name: 'database-consumers',
      severity: 'error',
      from: {
        pathNot: [
          '^packages/database',
          '^apps/api/src/modules/[^/]+/persistence/',
          '^apps/api/src/modules/[^/]+/[^/]+/persistence/',
          '^apps/api/src/infrastructure/prisma/',
          '^apps/api/src/infrastructure/realtime/outbox\\.repository\\.ts$',
          '^apps/api/src/cli/',
          '^apps/api/test/',
          '^tools/(legacy-migration|perf)/',
        ],
      },
      to: { path: '^packages/database' },
    },
    {
      name: 'api-resolvers-no-persistence',
      severity: 'error',
      from: {
        path: [
          '^apps/api/src/modules/[^/]+/graphql/',
          '^apps/api/src/modules/[^/]+/[^/]+/graphql/',
        ],
      },
      to: { path: ['/persistence/', '^packages/database', 'node_modules/ioredis/'] },
    },
    {
      name: 'api-core-no-modules',
      severity: 'error',
      from: { path: '^apps/api/src/(common|infrastructure)/' },
      to: { path: '^apps/api/src/modules/' },
    },
    {
      name: 'api-module-public-api',
      severity: 'error',
      from: { path: '^apps/api/src/modules/([^/]+)/' },
      to: {
        path: '^apps/api/src/modules/[^/]+/',
        pathNot: ['^apps/api/src/modules/$1/', '^apps/api/src/modules/[^/]+/index\\.ts$'],
      },
    },
    {
      name: 'web-feature-public-api',
      severity: 'error',
      from: { path: '^apps/web/src/features/([^/]+)/' },
      to: {
        path: '^apps/web/src/features/[^/]+/',
        pathNot: ['^apps/web/src/features/$1/', '^apps/web/src/features/[^/]+/index\\.ts$'],
      },
    },
    {
      name: 'web-shared-no-features',
      severity: 'error',
      from: { path: '^apps/web/src/(components|lib|hooks|providers)/' },
      to: { path: '^apps/web/src/features/' },
    },
    {
      name: 'no-test-imports',
      severity: 'error',
      from: { pathNot: TESTS },
      to: { path: TESTS },
    },
    {
      name: 'not-to-dev-dependency',
      severity: 'error',
      from: { path: '^(apps|packages)/[^/]+/src', pathNot: TESTS },
      to: { dependencyTypes: ['npm-dev'], dependencyTypesNot: ['type-only'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: {
      path: '(^|/)(node_modules|dist|\\.next|\\.next-e2e|playwright-report|test-results|\\.turbo|coverage|__generated__|generated)/',
    },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
  },
};
