import { graphql } from '@/graphql/__generated__';

/** What product lists and forms show. `costPrice` is separate: admins only (SEC-03). */
export const ProductFieldsFragment = graphql(`
  fragment ProductFields on Product {
    id
    barcode
    name
    nameUrdu
    categoryId
    categoryName
    baseUnitLabel
    piecesPerBox
    salePrice
    boxPrice
    taxRate
    lowStockThresholdPieces
    lowStockThresholdUnit
    stockPieces
    isLowStock
    archivedAt
    version
  }
`);

/** The fields a `product.changed` snapshot carries; realtime patches write exactly these. */
export const ProductSnapshotFieldsFragment = graphql(`
  fragment ProductSnapshotFields on Product {
    id
    barcode
    name
    nameUrdu
    categoryId
    baseUnitLabel
    piecesPerBox
    salePrice
    boxPrice
    taxRate
    lowStockThresholdPieces
    lowStockThresholdUnit
    stockPieces
    isLowStock
    archivedAt
    version
  }
`);

/** The fields a `stock.changed` item carries. */
export const ProductStockFragment = graphql(`
  fragment ProductStock on Product {
    id
    stockPieces
    isLowStock
    version
  }
`);
