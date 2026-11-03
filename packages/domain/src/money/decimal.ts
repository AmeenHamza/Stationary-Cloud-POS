import { Decimal as BaseDecimal } from 'decimal.js';

/**
 * The only Decimal constructor used for money (DECISIONS.md ADR-013): half-up rounding and no
 * exponent notation for any amount this system can hold.
 */
export const Decimal = BaseDecimal.clone({
  precision: 40,
  rounding: BaseDecimal.ROUND_HALF_UP,
  toExpNeg: -40,
  toExpPos: 40,
});

export type Decimal = BaseDecimal;
