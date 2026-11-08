import { Fragment } from 'react';

import { DEFAULT_BUSINESS_TIMEZONE } from '@pos/contracts';
import { formatDateTime, formatRs, money } from '@pos/domain';

import { PAYMENT_METHOD_LABEL } from '@/components/ledger/khata-labels';

import type { ReceiptFieldsFragment as Receipt } from '@/graphql/__generated__/graphql';

const APP_TITLE = 'BrandWings BusinessHub Smart Point of Sale';

function shopInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

function HeaderMeta({ when }: { when: string }) {
  return (
    <div className="receipt-header-meta">
      <span>{when}</span>
      <span>{APP_TITLE}</span>
    </div>
  );
}

function ShopSection({ receipt }: { receipt: Receipt }) {
  return (
    <div className="receipt-center">
      {receipt.logoDataUrl !== null ? (
        <img src={receipt.logoDataUrl} alt="Shop logo" className="receipt-logo" />
      ) : (
        <div className="receipt-logo receipt-logo-fallback">{shopInitials(receipt.shopName)}</div>
      )}
      <strong className="receipt-shop">{receipt.shopName}</strong>
      {receipt.address !== null && <div className="receipt-address">{receipt.address}</div>}
      {receipt.phone !== null && <div>Tel: {receipt.phone}</div>}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="receipt-row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function barcodeBits(value: string): string {
  return value
    .split('')
    .map((char) => char.charCodeAt(0).toString(2).padStart(8, '0'))
    .join('');
}

function ReceiptBarcode({ value }: { value: string }) {
  const bits = `1010${barcodeBits(value)}0101`;
  const width = bits.length;
  return (
    <div className="receipt-barcode" aria-hidden>
      <svg viewBox={`0 0 ${String(width)} 54`} role="img" aria-label={`Barcode ${value}`}>
        <rect x="0" y="0" width={String(width)} height="54" fill="#fff" />
        {bits
          .split('')
          .map((bit, index) =>
            bit === '1' ? (
              <rect key={index} x={String(index)} y="0" width="1" height="54" fill="#000" />
            ) : null,
          )}
      </svg>
    </div>
  );
}

/** Image-matched 80mm receipt layout using server-calculated amounts only. */
export function ReceiptBody({ receipt }: { receipt: Receipt }) {
  const when = formatDateTime(new Date(receipt.createdAt), DEFAULT_BUSINESS_TIMEZONE);
  const overallDiscount = money(receipt.discountTotal).minus(receipt.itemDiscountTotal);
  return (
    <div className="receipt" data-receipt={receipt.billNumber}>
      <HeaderMeta when={when} />
      <hr />
      <ShopSection receipt={receipt} />
      <hr />
      <DetailRow label="Invoice No." value={receipt.billNumber} />
      <DetailRow label="Date & Time" value={when} />
      <DetailRow label="Cashier" value={receipt.cashierName} />
      {receipt.customerName !== null && <DetailRow label="Customer" value={receipt.customerName} />}
      <hr />
      <table className="receipt-table" aria-label="Bill items">
        <thead>
          <tr>
            <th>ITEM</th>
            <th>QTY</th>
            <th>PRICE</th>
            <th>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {receipt.lines.map((line, index) => (
            <Fragment key={index}>
              <tr>
                <td className="receipt-item-name">{line.name}</td>
                <td className="receipt-item-qty">{line.quantity}</td>
                <td className="receipt-item-price">{formatRs(line.unitPrice)}</td>
                <td className="receipt-item-total">{formatRs(line.lineTotal)}</td>
              </tr>
              {line.itemDiscount !== '0.00' && (
                <tr>
                  <td className="receipt-item-discount" colSpan={4}>
                    Item discount -{formatRs(line.itemDiscount)}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
      <hr />
      <DetailRow label="Subtotal" value={formatRs(receipt.subtotal)} />
      {receipt.itemDiscountTotal !== '0.00' && (
        <DetailRow label="Item discount" value={`-${formatRs(receipt.itemDiscountTotal)}`} />
      )}
      {!overallDiscount.isZero() && (
        <DetailRow label="Discount" value={`-${formatRs(overallDiscount)}`} />
      )}
      {receipt.productTaxTotal !== '0.00' && (
        <DetailRow label="Product tax" value={formatRs(receipt.productTaxTotal)} />
      )}
      {receipt.billGstRate !== null && (
        <DetailRow
          label={`Bill GST ${receipt.billGstRate}%`}
          value={formatRs(receipt.billGstAmount)}
        />
      )}
      <div className="receipt-grand-total">
        <span>Grand Total</span>
        <span>{formatRs(receipt.total)}</span>
      </div>
      <DetailRow label="Payment Method" value={PAYMENT_METHOD_LABEL[receipt.paymentMethod]} />
      {receipt.customerBalance !== null && (
        <DetailRow label="Balance after this bill" value={formatRs(receipt.customerBalance)} />
      )}
      <ReceiptBarcode value={receipt.billNumber} />
      <div className="receipt-barcode-text">{receipt.billNumber}</div>
      {receipt.footer !== null && <div className="receipt-footer">{receipt.footer}</div>}
      {receipt.exchangeReturnPolicy !== null && (
        <section className="receipt-policy">
          <h3>EXCHANGE & RETURN POLICY</h3>
          <p>{receipt.exchangeReturnPolicy}</p>
        </section>
      )}
    </div>
  );
}
