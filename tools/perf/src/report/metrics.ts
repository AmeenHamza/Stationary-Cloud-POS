import { WORKLOAD } from '../config.js';

import type { OperationStats } from '../measure/http-client.js';
import type { DayResult } from '../scenarios/day-simulation.js';

/** Figures compared with the budgets (names match `budgets.json`) plus context for the report. */
export interface PerfMetrics {
  bills: number;
  lines: number;
  refunds: number;
  dbBytesScanBill3Lines: number;
  dbBytesSearchBill3Lines: number;
  dbBytesPerBillAmortized: number;
  dbBytesIdleHour: number;
  dbBytesDay: number;
  dbBytesMonth: number;
  dbBytesMonthTarget: number;
  wsLargestEventBytes: number;
  wsIdleBytesPerMinutePerChannel: number;
  wsEventsPerBillPerChannel: number;
  httpRequestsPerBill: number;
  /** Largest response of each §4.2 operation in the day (uncompressed JSON, with `__typename`). */
  responseProductByBarcode: number;
  responseTerminalProducts: number;
  responseCreateSale: number;
  responseOrders: number;
  responseCustomerLedger: number;
  responseDashboardLive: number;
  responseDashboardHistory: number;
  responseLowStockProducts: number;
}

/** The largest response of `operation` from either tab. */
function largest(day: DayResult, operation: string): number {
  return Math.max(
    day.http.counters.byOperation.get(operation)?.largest ?? 0,
    day.http.admin.byOperation.get(operation)?.largest ?? 0,
  );
}

const hundredths = (value: number): number => Math.round(value * 100) / 100;

const average = (stats: OperationStats | undefined, field: 'dbBytes' | 'received'): number =>
  stats === undefined || stats.count === 0 ? 0 : stats[field] / stats.count;

/**
 * The §4.1 model: a 3-line bill by scanning is three lookups and the sale; by searching it is six
 * searches and the sale. The month is 30 days of one simulated day, idle hours included.
 */
export function metricsOf(day: DayResult): PerfMetrics {
  const counters = day.http.counters.byOperation;
  const sale = average(counters.get('CreateSale'), 'dbBytes');
  const idleHour = (day.db.idle.bytes * 3_600) / day.db.idle.seconds;
  const working = day.db.open.bytes + day.db.trading.bytes;
  const dayBytes = working + idleHour * WORKLOAD.idleHoursPerDay;
  const bills = day.bills.length;
  const idleMinutes = day.db.idle.seconds / 60;
  return {
    bills,
    lines: day.bills.reduce((total, bill) => total + bill.lines, 0),
    refunds: day.refunds,
    dbBytesScanBill3Lines: Math.round(
      3 * average(counters.get('ProductByBarcode'), 'dbBytes') + sale,
    ),
    dbBytesSearchBill3Lines: Math.round(
      6 * average(counters.get('TerminalProducts'), 'dbBytes') + sale,
    ),
    dbBytesPerBillAmortized: Math.round(working / bills),
    dbBytesIdleHour: Math.round(idleHour),
    dbBytesDay: Math.round(dayBytes),
    dbBytesMonth: Math.round(dayBytes * WORKLOAD.daysPerMonth),
    dbBytesMonthTarget: Math.round(dayBytes * WORKLOAD.daysPerMonth),
    wsLargestEventBytes: day.ws.largestEvent,
    wsIdleBytesPerMinutePerChannel: Math.round(day.ws.idleBytes / day.ws.channels / idleMinutes),
    wsEventsPerBillPerChannel: hundredths(day.ws.events / day.ws.channels / bills),
    httpRequestsPerBill: hundredths((day.http.counters.requests - day.http.countersAtOpen) / bills),
    responseProductByBarcode: largest(day, 'ProductByBarcode'),
    responseTerminalProducts: largest(day, 'TerminalProducts'),
    responseCreateSale: largest(day, 'CreateSale'),
    responseOrders: largest(day, 'Orders'),
    responseCustomerLedger: largest(day, 'CustomerLedger'),
    responseDashboardLive: largest(day, 'DashboardLive'),
    responseDashboardHistory: largest(day, 'DashboardHistory'),
    responseLowStockProducts: largest(day, 'LowStockProducts'),
  };
}
