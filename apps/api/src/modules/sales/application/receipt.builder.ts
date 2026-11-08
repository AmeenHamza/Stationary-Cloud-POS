import { Injectable } from '@nestjs/common';

import { AppError } from '../../../common/errors/app-error';
import { SettingsService } from '../../settings';
import { OrdersRepository, type OrderDetailRow } from '../persistence/orders.repository';

import { toOrderView } from './order-view';

/**
 * The 80 mm receipt (SYSTEM_DESIGN.md §3.5, Q6b): shop profile, bill number, date, cashier,
 * lines, totals, payment method and, for Udhaar, the customer and their balance after this bill.
 * Built from the stored bill, so a reprint shows exactly what was charged.
 */
@Injectable()
export class ReceiptBuilder {
  constructor(
    private readonly orders: OrdersRepository,
    private readonly settings: SettingsService,
  ) {}

  async build(order: OrderDetailRow, customerBalance: string | null) {
    const shop = await this.settings.profile();
    const view = toOrderView(order);
    return {
      shopName: shop.shopName,
      address: shop.address,
      phone: shop.phone,
      logoDataUrl: shop.logoDataUrl,
      footer: shop.receiptFooter,
      exchangeReturnPolicy: shop.exchangeReturnPolicy,
      ...view,
      orderId: view.id,
      customerBalance,
      lines: order.lines.map((line) => ({
        name: line.productName,
        nameUrdu: line.productNameUrdu,
        unit: line.saleUnit,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.lineGross,
        itemDiscount: line.itemDiscount,
      })),
    };
  }

  /** Receipt for an existing bill (reprint, or a replayed sale). */
  async forOrder(orderId: string) {
    const order = await this.orders.findById(orderId);
    if (order === null) {
      throw new AppError('NOT_FOUND', 'This bill does not exist.');
    }
    const balance =
      order.paymentMethod === 'UDHAAR' ? await this.orders.creditBalanceAfter(orderId) : null;
    return { order, receipt: await this.build(order, balance) };
  }
}

export type ReceiptView = Awaited<ReturnType<ReceiptBuilder['build']>>;
