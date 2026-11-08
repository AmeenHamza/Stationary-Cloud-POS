import { Injectable } from '@nestjs/common';

import { hasPermission } from '@pos/contracts';
import { formatBillNumber, money, toMoneyString, type BillResult } from '@pos/domain';

import { AppError } from '../../../common/errors/app-error';
import { runIdempotent } from '../../../common/idempotency/idempotent-replay';
import { requestHashBytes } from '../../../common/idempotency/request-hash';
import { toDateColumn } from '../../../common/time/date-column';
import { UnitOfWork } from '../../../infrastructure/unit-of-work/unit-of-work';
import { SaleStockService } from '../../catalog';
import { CustomersService } from '../../khata';
import { BillCounterRepository } from '../persistence/bill-counter.repository';
import { OrdersRepository } from '../persistence/orders.repository';

import {
  billLineInputs,
  customLinesOf,
  givesDiscount,
  orderLinesData,
  outOfStockNames,
} from './create-sale.lines';
import { toOrderView } from './order-view';
import { ReceiptBuilder } from './receipt.builder';
import { SaleEvents } from './sale-events';
import { billOf, priceLines } from './sale-pricing';

import type { Principal } from '../../../common/auth/principal';
import type { CreateSaleInput } from '@pos/validation';

/** The money columns of a bill, as stored (two decimals). */
function stored(bill: BillResult) {
  return {
    subtotal: toMoneyString(bill.subtotal),
    discountTotal: toMoneyString(bill.discountTotal),
    itemDiscountTotal: toMoneyString(bill.itemDiscountTotal),
    productTaxTotal: toMoneyString(bill.productTaxTotal),
    billGstRate: bill.billGstRate === null ? null : toMoneyString(bill.billGstRate),
    billGstAmount: toMoneyString(bill.billGstAmount),
    total: toMoneyString(bill.total),
  };
}

/** The flat amount or the percentage the cashier entered; 0 for no discount (DB CHECK). */
function discountValue(discount: CreateSaleInput['discount']): string {
  if (discount.type === 'FLAT') {
    return discount.amount ?? '0';
  }
  return discount.type === 'PERCENT' ? (discount.percent ?? '0') : '0';
}

/**
 * `createSale` [K] (SYSTEM_DESIGN.md §3.3, F-19–F-22): lock the products in ascending id order,
 * price the bill from the locked rows with the shared domain function, refuse a different total
 * than the cashier saw (PRICE_CHANGED), then write bill, stock, khata and events in one transaction.
 * Products at 0 or negative stock are blocked; remaining oversells still surface as warnings.
 */
@Injectable()
export class CreateSaleService {
  constructor(
    private readonly saleStock: SaleStockService,
    private readonly customers: CustomersService,
    private readonly counters: BillCounterRepository,
    private readonly orders: OrdersRepository,
    private readonly receipts: ReceiptBuilder,
    private readonly events: SaleEvents,
    private readonly uow: UnitOfWork,
  ) {}

  execute(input: CreateSaleInput, viewer: Principal) {
    if (givesDiscount(input) && !hasPermission(viewer.role, 'sales:discount')) {
      throw new AppError('FORBIDDEN', 'You may not give discounts.');
    }
    if (input.paymentMethod === 'UDHAAR' && input.customerId === null) {
      throw new AppError('CUSTOMER_REQUIRED', 'Choose the customer for an Udhaar bill.');
    }
    const requestHash = requestHashBytes(input);
    return runIdempotent({
      keyColumn: 'idempotency_key',
      requestHash,
      execute: () => this.uow.run(() => this.sell(input, requestHash, viewer)),
      replay: async () => {
        const found = await this.orders.findByKey(input.idempotencyKey);
        if (found?.requestHash == null) {
          return null;
        }
        const { order, receipt } = await this.receipts.forOrder(found.id);
        const result = { order: toOrderView(order), receipt, stockWarnings: [], replayed: true };
        return { requestHash: found.requestHash, result };
      },
    });
  }

  private async sell(
    input: CreateSaleInput,
    requestHash: Uint8Array<ArrayBuffer>,
    viewer: Principal,
  ) {
    await this.assertCustomer(input.customerId, input.paymentMethod === 'UDHAAR');
    const priced = priceLines(
      input.lines,
      await this.saleStock.lock(input.lines.map((l) => l.productId)),
    );
    const custom = customLinesOf(input);
    const blocked = outOfStockNames(priced);
    if (blocked.length > 0) {
      throw new AppError(
        'BAD_USER_INPUT',
        'Some products are out of stock. Remove them and try again.',
        {
          fieldErrors: { lines: `${blocked.join(', ')} cannot be sold at 0 or negative stock` },
        },
      );
    }
    const bill = billOf(billLineInputs(priced, custom), input.discount, input.billGst);
    if (!bill.total.equals(money(input.expectedTotal))) {
      throw new AppError('PRICE_CHANGED', 'Prices changed since the cart was totalled.', {
        quote: stored(bill),
      });
    }
    const { businessDate, sequence } = await this.counters.next();
    const order = await this.orders.insert({
      ...stored(bill),
      billNumber: formatBillNumber(businessDate, sequence),
      businessDate: toDateColumn(businessDate),
      idempotencyKey: input.idempotencyKey,
      requestHash,
      cashierId: viewer.userId,
      cashierName: await this.orders.cashierName(viewer.userId),
      customerId: input.customerId,
      paymentMethod: input.paymentMethod,
      discountType: input.discount.type,
      discountValue: discountValue(input.discount),
      lines: { createMany: { data: orderLinesData(priced, custom, bill) } },
    });
    const after =
      priced.length === 0
        ? []
        : await this.saleStock.move(
            'SALE',
            { orderId: order.id },
            priced.map((line) => ({
              productId: line.product.id,
              pieces: line.quantity * line.piecesPerUnit,
            })),
            viewer.userId,
          );
    const credit =
      input.customerId !== null && input.paymentMethod === 'UDHAAR'
        ? await this.customers.postCreditSale(
            input.customerId,
            order.id,
            toMoneyString(bill.total),
            viewer.userId,
          )
        : null;
    await this.events.orderCreated(order);
    return {
      order: toOrderView(order),
      receipt: await this.receipts.build(order, credit === null ? null : credit.balance.toString()),
      stockWarnings: after
        .filter((product) => product.stockPieces < 0)
        .map((product) => ({
          productId: product.id,
          productName: product.name,
          stockAfter: product.stockPieces,
        })),
      replayed: false,
    };
  }

  /** An Udhaar bill needs an active customer (D-15); others may name one for the history filter. */
  private async assertCustomer(customerId: string | null, required: boolean): Promise<void> {
    if (customerId === null) {
      return;
    }
    const customer = await this.customers.byId(customerId);
    if (customer === null || (required && customer.archivedAt !== null)) {
      throw new AppError('NOT_FOUND', 'Choose an active customer.', {
        fieldErrors: { customerId: 'This customer does not exist or is archived' },
      });
    }
  }
}
