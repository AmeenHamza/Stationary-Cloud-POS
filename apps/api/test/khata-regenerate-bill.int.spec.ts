import { describe, expect, it } from 'vitest';

import { dataOf } from './support/graphql-client';
import * as khata from './support/khata';
import { useRoles } from './support/roles';
import * as sales from './support/sales';
import { asUser } from './support/staff';

const t = useRoles();

const LEDGER = `query Ledger($customerId: ID!) {
  customerLedger(customerId: $customerId) { nodes { type orderId billNumber } }
}`;

const RECEIPT = `query Receipt($orderId: ID!) {
  orderReceipt(orderId: $orderId) {
    billNumber customerName customerBalance total itemDiscountTotal
    lines { name unitPrice lineTotal itemDiscount }
  }
}`;

interface Entry {
  type: string;
  orderId: string | null;
  billNumber: string | null;
}

describe('regenerating a customer bill from the khata (F-40)', () => {
  it('gives each Udhaar entry its bill, and the cashier gets back exactly what was charged', async () => {
    const customer = await khata.createCustomer(t.h.url, t.cashier, {
      name: 'Loyal Buyer',
      phone: null,
      email: null,
      address: null,
    });
    const productId = await sales.seedProduct(t.prisma, { name: 'Register', price: '100' });
    const sale = dataOf(
      await sales.sellAsCashier(
        t,
        sales.saleInput(
          [{ productId, quantity: 2, discount: { type: 'PERCENT', percent: '10' } }],
          { paymentMethod: 'UDHAAR', customerId: customer.id, expectedTotal: '180.00' },
        ),
      ),
    ).createSale;
    await asUser(t.h.url, t.cashier, khata.ADD_CREDIT, {
      input: khata.entryInput({ customerId: customer.id, amount: '50.00', note: null }),
    });

    const ledger = dataOf(
      await asUser<{ customerLedger: { nodes: Entry[] } }>(t.h.url, t.cashier, LEDGER, {
        customerId: customer.id,
      }),
    ).customerLedger.nodes;
    expect(ledger).toEqual([
      { type: 'MANUAL_CREDIT', orderId: null, billNumber: null }, // nothing to regenerate
      { type: 'CREDIT_SALE', orderId: sale.order.id, billNumber: sale.order.billNumber },
    ]);

    // Later changes do not touch the bill: the price moved and the balance grew by 50.
    await t.prisma.product.update({
      where: { id: productId },
      data: { salePrice: '999' },
      select: { id: true },
    });
    const receipt = dataOf(
      await asUser<{ orderReceipt: Record<string, unknown> }>(t.h.url, t.cashier, RECEIPT, {
        orderId: sale.order.id,
      }),
    ).orderReceipt;
    expect(receipt).toEqual({
      billNumber: sale.order.billNumber,
      customerName: 'Loyal Buyer',
      customerBalance: '180.00',
      total: '180.00',
      itemDiscountTotal: '20.00',
      lines: [
        { name: 'Register', unitPrice: '100.00', lineTotal: '200.00', itemDiscount: '20.00' },
      ],
    });
  });
});
