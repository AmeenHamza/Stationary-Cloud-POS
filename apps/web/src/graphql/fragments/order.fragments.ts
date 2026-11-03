import { graphql } from '@/graphql/__generated__';

/** A full bill header, as the sale response returns it (F-23). */
export const OrderFieldsFragment = graphql(`
  fragment OrderFields on Order {
    id
    billNumber
    businessDate
    createdAt
    cashierName
    customerName
    paymentMethod
    subtotal
    discountType
    discountValue
    discountTotal
    productTaxTotal
    billGstRate
    billGstAmount
    total
    refundedTotal
    status
    version
  }
`);

/**
 * A row of the order history table (FEATURES.md §3.7): the columns it shows, so a page of 50 stays
 * within its payload budget (NETWORK_OPTIMIZATION.md §4.2), plus `refundedTotal` and `version`, which
 * the live `order.refunded` patch needs to find and update the row (RT-07).
 */
export const OrderRowFieldsFragment = graphql(`
  fragment OrderRowFields on Order {
    id
    billNumber
    createdAt
    paymentMethod
    subtotal
    discountType
    discountValue
    discountTotal
    billGstAmount
    total
    refundedTotal
    status
    version
  }
`);

/** The fields an `order.refunded` event carries; the realtime patch writes exactly these. */
export const OrderRefundStateFragment = graphql(`
  fragment OrderRefundState on Order {
    id
    status
    refundedTotal
    version
  }
`);

/** Everything the 80 mm receipt prints (SYSTEM_DESIGN.md §3.5, Q6b). */
export const ReceiptFieldsFragment = graphql(`
  fragment ReceiptFields on Receipt {
    orderId
    billNumber
    createdAt
    shopName
    address
    phone
    logoDataUrl
    footer
    exchangeReturnPolicy
    cashierName
    customerName
    customerBalance
    paymentMethod
    lines {
      name
      nameUrdu
      quantity
      unit
      unitPrice
      lineTotal
    }
    subtotal
    discountTotal
    productTaxTotal
    billGstRate
    billGstAmount
    total
  }
`);
