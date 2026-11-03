import { graphql } from '@/graphql/__generated__';

/** Stock changes and the low-stock list and badge (F-10, F-13, F-32). */
export const RestockProductDocument = graphql(`
  mutation RestockProduct($input: RestockInput!) {
    restockProduct(input: $input) {
      ...ProductStock
    }
  }
`);

export const AdjustStockDocument = graphql(`
  mutation AdjustStock($input: AdjustStockInput!) {
    adjustStock(input: $input) {
      ...ProductStock
    }
  }
`);

/** Sidebar badge: one COUNT, refetched only on `lowStock.countChanged` (no polling). */
export const LowStockCountDocument = graphql(`
  query LowStockCount {
    lowStockCount
  }
`);

export const LowStockProductsDocument = graphql(`
  query LowStockProducts($after: String) {
    lowStockProducts(after: $after) {
      nodes {
        ...ProductFields
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`);
