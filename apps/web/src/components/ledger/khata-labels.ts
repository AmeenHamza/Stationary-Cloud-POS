import type { PaymentMethod } from '@pos/contracts';

/** Display names of payment methods (FEATURES.md §3.8), shared by khata and billing. */
export const PAYMENT_METHOD_LABEL: Readonly<Record<PaymentMethod, string>> = {
  CASH: 'Cash',
  CARD: 'Card',
  EASYPAISA: 'Easypaisa',
  JAZZCASH: 'JazzCash',
  BANK_TRANSFER: 'Bank transfer',
  UDHAAR: 'Udhaar (credit)',
};

/** Methods a khata payment may use: every one except Udhaar (DATABASE.md §4.8). */
export const KHATA_PAYMENT_OPTIONS = (Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[])
  .filter((method) => method !== 'UDHAAR')
  .map((method) => ({ value: method, label: PAYMENT_METHOD_LABEL[method] }));

/** How a party's balance reads in each state (Q25): what "owed" means differs per party kind. */
export interface BalanceLabels {
  owed: string;
  advance: string;
  settled: string;
}

/** A party as khata lists and headers show it. `detail` is an extra line (e.g. products supplied). */
export interface PartySummary {
  id: string;
  name: string;
  phone: string | null;
  balance: string;
  archivedAt: string | null;
  detail?: string | null;
}

/** A ledger row; `reference` names a linked document such as a bill. */
export interface LedgerEntry {
  id: string;
  type: string;
  amount: string;
  balanceAfter: string;
  paymentMethod: PaymentMethod | null;
  note: string | null;
  businessDate: string;
  reference?: string | null;
}
