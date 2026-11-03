import { graphql } from '@/graphql/__generated__';

/** The terminal header date comes from the server's business date, never the PC clock (API.md §6.1). */
export const ServerInfoDocument = graphql(`
  query ServerInfo {
    serverInfo {
      businessDate
    }
  }
`);

/** What a tile and a cart line need: price, box price, tax and stock (no cost price, SEC-03). */
export const SaleProductFieldsFragment = graphql(`
  fragment SaleProductFields on Product {
    id
    name
    nameUrdu
    baseUnitLabel
    piecesPerBox
    salePrice
    boxPrice
    taxRate
    stockPieces
    isLowStock
    archivedAt
    version
  }
`);

/** The product grid (F-18): server-searched, 50 per page, never the whole catalogue. */
export const TerminalProductsDocument = graphql(`
  query TerminalProducts($after: String, $filter: ProductFilter, $sort: ProductSort) {
    products(after: $after, filter: $filter, sort: $sort) {
      nodes {
        ...SaleProductFields
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`);

/** A scan: exact barcode, active products only (SYSTEM_DESIGN.md §3.1). */
export const ProductByBarcodeDocument = graphql(`
  query ProductByBarcode($barcode: String!) {
    productByBarcode(barcode: $barcode) {
      ...SaleProductFields
    }
  }
`);

/** Cart products by id (≤ 50 per request); answered from the cache when all are there. */
export const CartProductsDocument = graphql(`
  query CartProducts($ids: [ID!]!) {
    productsByIds(ids: $ids) {
      ...SaleProductFields
    }
  }
`);
