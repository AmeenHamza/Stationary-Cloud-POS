import type { CodegenConfig } from '@graphql-codegen/cli';

/**
 * Typed documents from the committed SDL (ADR-004). Operations are written with `graphql()` next to
 * the feature that uses them; the output folder is generated and git-ignored.
 */
const config: CodegenConfig = {
  schema: '../../packages/contracts/schema.graphql',
  documents: ['src/**/*.{ts,tsx}', '!src/graphql/__generated__/**'],
  ignoreNoDocuments: true,
  generates: {
    'src/graphql/__generated__/': {
      preset: 'client',
      presetConfig: { fragmentMasking: false },
      config: {
        enumsAsTypes: true,
        useTypeImports: true,
        avoidOptionals: { field: true, inputValue: false, object: true, defaultValue: false },
        scalars: { Money: 'string', Percent: 'string', BusinessDate: 'string', DateTime: 'string' },
      },
    },
  },
};

export default config;
