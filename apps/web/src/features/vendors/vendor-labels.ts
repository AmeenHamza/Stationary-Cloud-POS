import type { BalanceLabels } from '@/components/ledger/khata-labels';
import type { VendorFieldsFragment } from '@/graphql/__generated__/graphql';
import type { VendorEntryType } from '@pos/contracts';

/** A vendor balance: + the shop owes the vendor ("we owe"), − the shop paid in advance. */
export const VENDOR_BALANCE_LABELS: BalanceLabels = {
  owed: 'we owe',
  advance: 'paid in advance',
  settled: 'Settled',
};

export const VENDOR_ENTRY_LABELS: Readonly<Record<VendorEntryType, string>> = {
  OPENING_BALANCE: 'Opening balance',
  PURCHASE: 'Purchase',
  PAYMENT: 'Payment',
};

/** A vendor as khata lists show it: "products supplied" is the extra line. */
export function vendorSummary(vendor: VendorFieldsFragment) {
  return { ...vendor, detail: vendor.productsSupplied };
}
