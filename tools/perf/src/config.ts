/** Dataset and workload of the network measurement (NETWORK_OPTIMIZATION.md §8.1–§8.2). */
export const DATASET = {
  categories: 22,
  products: 2_345,
  customers: 300,
  vendors: 60,
  historyDays: 365,
  billsPerHistoryDay: 50,
  /** Share of history bills on Udhaar (credit to a customer's khata). */
  udhaarShare: 0.05,
  /** Share of products at or below their low-stock level. */
  lowStockShare: 0.05,
  /** Share of products with an Urdu name, as in the screenshots. */
  urduNameShare: 0.6,
  seed: 0.42,
} as const;

export const WORKLOAD = {
  counters: 2,
  /** Bills per counter in one simulated day: 2 × 25 = 50 bills, the 1,500-a-month pace. */
  billsPerCounter: 25,
  meanLinesPerBill: 3.2,
  /** Lines added by scanning; the rest are found by searching (two searches per line). */
  scannedLineShare: 0.4,
  searchesPerSearchedLine: 2,
  udhaarShare: 0.05,
  refundShare: 0.02,
  restocks: 3,
  adminVisits: { dashboard: 5, orders: 5, khata: 10, lowStock: 3 },
  /** Real seconds of all-screens-open idleness measured and scaled to an hour (§4.1). */
  idleSampleSeconds: 60,
  /** Hours a day every screen sits open with nothing happening (§8.2). */
  idleHoursPerDay: 10,
  /** Days a month at this pace, for the monthly projection. */
  daysPerMonth: 30,
  seed: 7,
} as const;

/** Accounts created in the perf database; test-only credentials (never used elsewhere). */
export const PERF_USERS = {
  admin: {
    username: 'perf.admin',
    fullName: 'Perf Admin',
    role: 'ADMIN',
    password: 'perf-admin-pass-1',
  },
  counterA: {
    username: 'perf.counter.a',
    fullName: 'Perf Counter A',
    role: 'CASHIER',
    password: 'perf-counter-pass-1',
  },
  counterB: {
    username: 'perf.counter.b',
    fullName: 'Perf Counter B',
    role: 'CASHIER',
    password: 'perf-counter-pass-2',
  },
} as const;
export type PerfUser = (typeof PERF_USERS)[keyof typeof PERF_USERS];
