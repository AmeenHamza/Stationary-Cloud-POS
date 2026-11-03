import { Decimal } from '@pos/domain';

/** A money string as a plain number, for bar geometry only (amounts stay Decimal elsewhere). */
export function toAmount(value: string): number {
  return new Decimal(value).toNumber();
}

/** The axis top: the smallest 1, 2, 2.5 or 5 × 10ⁿ at or above the largest value (≥ 1). */
export function niceMax(values: readonly number[]): number {
  const largest = Math.max(1, ...values);
  const magnitude = 10 ** Math.floor(Math.log10(largest));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= largest) ?? 10;
  return step * magnitude;
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const full = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });

/** Axis ticks: in full under 10,000, compact above (dataviz: one style per axis value). */
export function axisLabel(value: number): string {
  return value < 10_000 ? full.format(value) : compact.format(value);
}
