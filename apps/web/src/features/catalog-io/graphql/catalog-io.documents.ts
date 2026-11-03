import { graphql } from '@/graphql/__generated__';

/** One import's progress (F-11); `import.progressed` events keep it current, so it is read once. */
export const ImportJobDocument = graphql(`
  query ImportJob($id: ID!) {
    importJob(id: $id) {
      ...ImportJobProgress
      fileName
      errorSummary
    }
  }
`);
