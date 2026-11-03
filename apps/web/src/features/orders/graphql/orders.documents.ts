import { graphql } from '@/graphql/__generated__';

/** Order history (F-15): newest first, 50 per page, the last 90 days unless dated or archived. */
export const OrdersDocument = graphql(`
  query Orders($after: String, $filter: OrdersFilter) {
    orders(after: $after, filter: $filter) {
      nodes {
        ...OrderRowFields
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`);

/** One bill with its lines and what each has had refunded (F-16, `#17`). */
export const OrderDetailDocument = graphql(`
  query OrderDetail($id: ID!) {
    order(id: $id) {
      id
      billNumber
      total
      status
      paymentMethod
      customerName
      billGstAmount
      refundedTotal
      refundedGstShare
      version
      lines {
        id
        lineNo
        productName
        saleUnit
        quantity
        refundedQuantity
        unitPrice
        lineNet
        lineTax
        refundedAmount
      }
    }
  }
`);

/** `refundOrder` [K] (SYSTEM_DESIGN.md §3.6): partial or full, always restocking (D-14). */
export const RefundOrderDocument = graphql(`
  mutation RefundOrder($input: RefundOrderInput!) {
    refundOrder(input: $input) {
      order {
        id
        status
        refundedTotal
        refundedGstShare
        version
        lines {
          id
          refundedQuantity
          refundedAmount
        }
      }
      refund {
        id
        amount
        settlement
      }
      replayed
    }
  }
`);

/** Reprint, or the receipt of a sale confirmed after its response was lost (§3.4, §3.5). */
export const OrderReceiptDocument = graphql(`
  query OrderReceipt($orderId: ID!) {
    orderReceipt(orderId: $orderId) {
      ...ReceiptFields
    }
  }
`);
