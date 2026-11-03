import type { BalanceLabels } from '@/components/ledger/khata-labels';
import type { CustomerEntryType } from '@pos/contracts';

/** A customer balance: + they owe the shop, − the shop holds an advance (Q25). */
export const CUSTOMER_BALANCE_LABELS: BalanceLabels = {
  owed: 'owed',
  advance: 'advance',
  settled: 'Settled',
};

export const CUSTOMER_ENTRY_LABELS: Readonly<Record<CustomerEntryType, string>> = {
  OPENING_BALANCE: 'Opening balance',
  CREDIT_SALE: 'Udhaar bill',
  MANUAL_CREDIT: 'Udhaar',
  PAYMENT: 'Payment',
  REFUND_CREDIT: 'Refund credit',
};
