import { graphql } from '@/graphql/__generated__';

/** An import's progress: what `import.progressed` carries and the progress view shows (F-11). */
export const ImportJobProgressFragment = graphql(`
  fragment ImportJobProgress on ImportJob {
    id
    status
    processedRows
    totalRows
    succeededRows
    failedRows
  }
`);
