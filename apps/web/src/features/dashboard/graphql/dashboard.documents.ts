import { graphql } from '@/graphql/__generated__';

/**
 * The tiles and period summaries (F-06): refetched, coalesced, after sales, refunds, stock and
 * khata changes (NETWORK_OPTIMIZATION.md §6). One request, five aggregates, ≤ 3 KB.
 */
export const DashboardLiveDocument = graphql(`
  query DashboardLive {
    dashboard {
      date
      today {
        netSales
        billCount
        discountTotal
        taxTotal
        refundTotal
      }
      inventory {
        sellingValue
        costValue
        productCount
      }
      customerDues
      thisWeekSales
      thisMonthSales
      categoryCount
      paymentMethodsToday: paymentMethods(period: TODAY) {
        method
        total
        billCount
      }
      paymentMethodsThisWeek: paymentMethods(period: THIS_WEEK) {
        method
        total
        billCount
      }
      paymentMethodsThisMonth: paymentMethods(period: THIS_MONTH) {
        method
        total
        billCount
      }
    }
  }
`);

/** The charts and rankings (F-07): closed periods, read once (cache-first), refreshed on request. */
export const DashboardHistoryDocument = graphql(`
  query DashboardHistory($year: Int!, $productId: ID) {
    dashboard {
      date
      monthlySales(year: $year) {
        month
        total
        sameMonthLastYear
      }
      dailySales(days: 31, productId: $productId) {
        date
        total
      }
      highest: productRanking(direction: HIGHEST) {
        productId
        name
        units
        total
      }
      lowest: productRanking(direction: LOWEST) {
        productId
        name
        units
        total
      }
    }
  }
`);

/** The weekly chart's product filter: a server search, 10 matches, never the whole catalogue. */
export const DashboardProductSearchDocument = graphql(`
  query DashboardProductSearch($search: String!) {
    products(first: 10, filter: { search: $search }) {
      nodes {
        id
        name
      }
    }
  }
`);
