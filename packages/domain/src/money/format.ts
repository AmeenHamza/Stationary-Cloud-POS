import { money, round2 } from './money.js';

import type { Decimal } from './decimal.js';

/** Thousands separators for an unsigned integer string ("1063816353" → "1,063,816,353"). */
function group(integerDigits: string): string {
  return integerDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Display format for money everywhere (UI, receipts, exports): "Rs 1,234.50", always two decimals
 * (Q24 default; fixes the old app's mixed 0/2-decimal display, audit R14).
 */
export function formatRs(value: Decimal | string): string {
  const amount = round2(money(value));
  const [integer = '0', fraction = '00'] = amount.abs().toFixed(2).split('.');
  const sign = amount.isNegative() ? '-' : '';
  return `${sign}Rs ${group(integer)}.${fraction}`;
}
