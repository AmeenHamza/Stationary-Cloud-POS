import { graphql } from '@/graphql/__generated__';

/** `createSale` [K] (SYSTEM_DESIGN.md §3.3): the bill, its receipt and any above-stock warnings. */
export const CreateSaleDocument = graphql(`
  mutation CreateSale($input: CreateSaleInput!) {
    createSale(input: $input) {
      order {
        ...OrderFields
      }
      receipt {
        ...ReceiptFields
      }
      stockWarnings {
        productId
        productName
        stockAfter
      }
      replayed
    }
  }
`);

/** Confirms a sale whose response was lost (SYSTEM_DESIGN.md §3.4). */
export const SaleStatusDocument = graphql(`
  query SaleStatus($idempotencyKey: ID!) {
    saleStatus(idempotencyKey: $idempotencyKey) {
      id
      billNumber
    }
  }
`);
