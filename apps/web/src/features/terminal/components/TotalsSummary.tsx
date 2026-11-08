import { formatRs, type BillResult } from '@pos/domain';

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={
        strong === true ? 'flex justify-between text-xl font-bold' : 'flex justify-between'
      }
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/** Order summary (`#43`, `#44`): subtotal, discount, product tax, Bill GST with its rate, TOTAL. */
export function TotalsSummary({ bill }: { bill: BillResult | null }) {
  if (bill === null) {
    return (
      <p className="text-muted-foreground">Enter a valid discount and Bill GST to see the total.</p>
    );
  }
  return (
    <div className="grid gap-1 rounded-lg bg-muted/50 p-3 text-sm" data-testid="payment-totals">
      <Line label="Subtotal" value={formatRs(bill.subtotal)} />
      {!bill.itemDiscountTotal.isZero() && (
        <Line label="Item discount" value={`-${formatRs(bill.itemDiscountTotal)}`} />
      )}
      {!bill.billDiscountTotal.isZero() && (
        <Line label="Discount" value={`-${formatRs(bill.billDiscountTotal)}`} />
      )}
      <Line label="Product tax" value={formatRs(bill.productTaxTotal)} />
      {bill.billGstRate !== null && (
        <Line
          label={`Bill GST (${bill.billGstRate.toString()}%)`}
          value={formatRs(bill.billGstAmount)}
        />
      )}
      <Line label="TOTAL" value={formatRs(bill.total)} strong />
    </div>
  );
}
