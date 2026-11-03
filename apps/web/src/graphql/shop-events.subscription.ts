import { graphql } from '@/graphql/__generated__';

/**
 * The one live channel per tab (API.md §7, rule 1). Each event carries only what its handler needs;
 * `change` is aliased per type because the product and category enums differ.
 */
export const ShopEventsDocument = graphql(`
  subscription ShopEvents {
    shopEvents {
      __typename
      seq
      type
      ... on StockChangedEvent {
        items {
          productId
          stockPieces
          isLowStock
          version
        }
      }
      ... on ProductChangedEvent {
        productChange: change
        productId
        version
        product {
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
      }
      ... on CategoryChangedEvent {
        categoryChange: change
        categoryId
        category {
          id
          name
          iconEmoji
          description
          version
        }
      }
      ... on LowStockCountChangedEvent {
        crossedProductIds
      }
      ... on CustomerBalanceChangedEvent {
        customerId
        balance
        version
      }
      ... on VendorBalanceChangedEvent {
        vendorId
        balance
        version
      }
      ... on OrderCreatedEvent {
        orderId
      }
      ... on OrderRefundedEvent {
        orderId
        status
        refundedTotal
        version
      }
      ... on ImportProgressedEvent {
        importJobId
        importStatus: status
        processedRows
        totalRows
        succeededRows
        failedRows
      }
      ... on CatalogBulkChangedEvent {
        importJobId
        changedCount
      }
      ... on SettingsChangedEvent {
        version
      }
      ... on ResyncRequiredEvent {
        reason
      }
    }
  }
`);
