/**
 * Accounts seeded into the throwaway e2e database. Test-only credentials, never used elsewhere.
 * The `login` rate limit allows 5 attempts per username and IP per 15 minutes (API.md §8), so each
 * spec file signs in with its own accounts: auth.spec uses admin/cashier, staff.spec uses manager,
 * catalog.spec uses stock, realtime.spec uses owner and watcher, khata.spec uses ledger and till,
 * billing.spec uses pricer, counter and counter2, refunds.spec uses refunder and auditor,
 * dashboard.spec uses overseer and seller (network.spec reuses their sessions), import.spec uses importer,
 * ai.spec uses advisor.
 * The `login-ip` limit (30 per IP per 15 minutes) covers the whole suite, so specs that are not about
 * logging in use `signInOnce`: one form sign-in per user per run, then the same session.
 */
export const E2E_USERS = {
  admin: {
    username: 'e2e.admin',
    fullName: 'Asha Admin',
    role: 'ADMIN',
    password: 'e2e-admin-pass-1',
  },
  manager: {
    username: 'e2e.manager',
    fullName: 'Maya Manager',
    role: 'ADMIN',
    password: 'e2e-manager-pass-1',
  },
  cashier: {
    username: 'e2e.cashier',
    fullName: 'Bilal Cashier',
    role: 'CASHIER',
    password: 'e2e-cashier-pass-1',
  },
  stock: {
    username: 'e2e.stock',
    fullName: 'Sana Stock',
    role: 'ADMIN',
    password: 'e2e-stock-pass-1',
  },
  owner: {
    username: 'e2e.owner',
    fullName: 'Omar Owner',
    role: 'ADMIN',
    password: 'e2e-owner-pass-1',
  },
  watcher: {
    username: 'e2e.watcher',
    fullName: 'Wafa Watcher',
    role: 'ADMIN',
    password: 'e2e-watcher-pass-1',
  },
  ledger: {
    username: 'e2e.ledger',
    fullName: 'Lubna Ledger',
    role: 'ADMIN',
    password: 'e2e-ledger-pass-1',
  },
  till: {
    username: 'e2e.till',
    fullName: 'Tariq Till',
    role: 'CASHIER',
    password: 'e2e-till-pass-1',
  },
  pricer: {
    username: 'e2e.pricer',
    fullName: 'Parveen Pricer',
    role: 'ADMIN',
    password: 'e2e-pricer-pass-1',
  },
  counter: {
    username: 'e2e.counter',
    fullName: 'Kamran Counter',
    role: 'CASHIER',
    password: 'e2e-counter-pass-1',
  },
  counter2: {
    username: 'e2e.counter2',
    fullName: 'Komal Counter',
    role: 'CASHIER',
    password: 'e2e-counter2-pass-1',
  },
  refunder: {
    username: 'e2e.refunder',
    fullName: 'Rafay Refunder',
    role: 'CASHIER',
    password: 'e2e-refunder-pass-1',
  },
  auditor: {
    username: 'e2e.auditor',
    fullName: 'Aliya Auditor',
    role: 'ADMIN',
    password: 'e2e-auditor-pass-1',
  },
  overseer: {
    username: 'e2e.overseer',
    fullName: 'Osman Overseer',
    role: 'ADMIN',
    password: 'e2e-overseer-pass-1',
  },
  seller: {
    username: 'e2e.seller',
    fullName: 'Saima Seller',
    role: 'CASHIER',
    password: 'e2e-seller-pass-1',
  },
  importer: {
    username: 'e2e.importer',
    fullName: 'Imran Importer',
    role: 'ADMIN',
    password: 'e2e-importer-pass-1',
  },
  advisor: {
    username: 'e2e.advisor',
    fullName: 'Amna Advisor',
    role: 'ADMIN',
    password: 'e2e-advisor-pass-1',
  },
} as const;

export type E2eUser = (typeof E2E_USERS)[keyof typeof E2E_USERS];

/** Dedicated ports, so the suite never collides with development servers on 3000/4000. */
export const WEB_PORT = 3100;
export const API_PORT = 4100;
export const WEB_URL = `http://localhost:${String(WEB_PORT)}`;
export const API_URL = `http://localhost:${String(API_PORT)}`;

/** The Groq stub the e2e API calls (`GROQ_BASE_URL`, TESTING.md E2E-14). */
export const GROQ_STUB_PORT = 4199;

/** The e2e API's log lines, kept so E2E-14 can check that no secret was logged (SEC-11). */
export const API_LOG_FILE = new URL('../api-e2e.log', import.meta.url);
