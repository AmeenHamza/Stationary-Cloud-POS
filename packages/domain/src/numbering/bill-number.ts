import { DomainRuleError } from '../errors.js';
import { isBusinessDate } from '../time/business-date.js';

import type { BusinessDate } from '../time/business-date.js';

const BILL_NUMBER = /^ORD-(\d{4})(\d{2})(\d{2})-(\d{3,})$/;

/** `ORD-YYYYMMDD-NNN` with at least 3 sequence digits (BR-05, ADR-014). */
export function formatBillNumber(businessDate: BusinessDate, sequence: number): string {
  if (!isBusinessDate(businessDate) || !Number.isInteger(sequence) || sequence < 1) {
    throw new DomainRuleError('BAD_USER_INPUT', 'Invalid bill number parts');
  }
  return `ORD-${businessDate.replaceAll('-', '')}-${String(sequence).padStart(3, '0')}`;
}

export function parseBillNumber(
  billNumber: string,
): { businessDate: BusinessDate; sequence: number } | null {
  const match = BILL_NUMBER.exec(billNumber);
  if (match === null) {
    return null;
  }
  // The pattern has exactly four capture groups, so all four are present after a match.
  const [year, month, day, sequence] = match.slice(1, 5) as [string, string, string, string];
  const businessDate = `${year}-${month}-${day}`;
  return isBusinessDate(businessDate)
    ? { businessDate, sequence: Number.parseInt(sequence, 10) }
    : null;
}
