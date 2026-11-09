/**
 * Findings of the dry run (DATABASE.md §11 step 4). Blocking ones stop `--apply` until the owner fixes
 * the data in the old app; the others are handled by the documented defaults (FEATURES.md Q35, Q41–Q44).
 */
export type IssueKind =
  | 'category-merged'
  | 'text-truncated'
  | 'invalid-value'
  | 'missing-reference'
  | 'barcode-duplicate'
  | 'barcode-too-long'
  | 'box-price-dropped'
  | 'implausible-product'
  | 'unknown-ledger-type'
  | 'unknown-payment-method'
  | 'payment-method-defaulted'
  | 'zero-amount'
  | 'udhaar-without-customer'
  | 'order-without-items'
  | 'too-many-lines'
  | 'duplicate-bill-number'
  | 'total-mismatch'
  | 'refund-mismatch'
  | 'status-differs'
  | 'split-payment'
  | 'bill-date-differs';

export interface Issue {
  kind: IssueKind;
  blocking: boolean;
  /** The old record, e.g. `orders#1286`. */
  ref: string;
  detail: string;
}

export class Issues {
  readonly list: Issue[] = [];

  /** A finding handled by a default. */
  note(kind: IssueKind, ref: string, detail: string): void {
    this.list.push({ kind, blocking: false, ref, detail });
  }

  /** A finding the migration cannot handle: `--apply` refuses until it is fixed. */
  block(kind: IssueKind, ref: string, detail: string): void {
    this.list.push({ kind, blocking: true, ref, detail });
  }

  get blocking(): number {
    return this.list.filter((issue) => issue.blocking).length;
  }
}
