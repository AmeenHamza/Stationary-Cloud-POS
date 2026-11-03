import { Injectable } from '@nestjs/common';

import {
  calculateRefund,
  money,
  refundAllRequest,
  refundSnapshotOf,
  toMoneyString,
  type RefundOrderSnapshot,
} from '@pos/domain';

import { AppError } from '../../../common/errors/app-error';
import { runIdempotent } from '../../../common/idempotency/idempotent-replay';
import { requestHashBytes } from '../../../common/idempotency/request-hash';
import { UnitOfWork } from '../../../infrastructure/unit-of-work/unit-of-work';
import { AuditService } from '../../audit';
import { SaleStockService } from '../../catalog';
import { CustomersService } from '../../khata';
import { OrdersRepository, type OrderDetailRow } from '../persistence/orders.repository';
import { RefundsRepository, type RefundRow } from '../persistence/refunds.repository';

import { toOrderDetailView } from './order-view';
import { SaleEvents } from './sale-events';

import type { Principal } from '../../../common/auth/principal';
import type { RefundOrderInput } from '@pos/validation';

/** What the domain refund maths needs from a stored bill (A-06). */
function snapshotOf(
  order: OrderDetailRow,
  refunded: Awaited<ReturnType<OrdersRepository['refundedSoFar']>>,
): RefundOrderSnapshot {
  return refundSnapshotOf({
    lines: order.lines.map((line) => ({
      id: line.id.toString(),
      quantity: line.quantity,
      refundedQuantity: line.refundedQuantity,
      lineNet: line.lineNet.toString(),
      lineTax: line.lineTax.toString(),
      refundedAmount: refunded.byLine.get(line.id) ?? '0',
    })),
    billGstAmount: order.billGstAmount.toString(),
    refundedGstShare: refunded.gstShare,
  });
}

/**
 * `refundOrder` [K] (SYSTEM_DESIGN.md §3.6, F-16): lock the bill, compute the refund with the shared
 * domain function, refuse an amount other than the cashier saw (QUOTE_MISMATCH), then record it,
 * return items to stock (D-14) and, for Udhaar bills, credit the khata (A-03) — one transaction.
 */
@Injectable()
export class RefundOrderService {
  constructor(
    private readonly refunds: RefundsRepository,
    private readonly orders: OrdersRepository,
    private readonly saleStock: SaleStockService,
    private readonly customers: CustomersService,
    private readonly events: SaleEvents,
    private readonly audit: AuditService,
    private readonly uow: UnitOfWork,
  ) {}

  execute(input: RefundOrderInput, viewer: Principal) {
    const requestHash = requestHashBytes(input);
    return runIdempotent({
      keyColumn: 'idempotency_key',
      requestHash,
      execute: () => this.uow.run(() => this.refund(input, requestHash, viewer)),
      replay: async () => {
        const found = await this.refunds.findByKey(input.idempotencyKey);
        if (found?.requestHash == null) {
          return null;
        }
        const result = { order: await this.detail(found.orderId), refund: found, replayed: true };
        return { requestHash: found.requestHash, result };
      },
    });
  }

  private async refund(
    input: RefundOrderInput,
    requestHash: Uint8Array<ArrayBuffer>,
    viewer: Principal,
  ) {
    const order =
      (await this.refunds.lockOrder(input.orderId)) && (await this.orders.findById(input.orderId));
    if (order === false || order === null) {
      throw new AppError('NOT_FOUND', 'This bill does not exist.');
    }
    const snapshot = snapshotOf(order, await this.orders.refundedSoFar(order.id));
    const request = input.refundAll
      ? refundAllRequest(snapshot)
      : input.lines.map((line) => ({ lineId: line.orderLineId, quantity: line.quantity }));
    const result = calculateRefund(snapshot, request);
    const amount = toMoneyString(result.amount);
    if (!result.amount.equals(money(input.expectedAmount))) {
      throw new AppError('QUOTE_MISMATCH', 'The refund amount changed. Check it and confirm.', {
        amount,
      });
    }
    const udhaar = order.paymentMethod === 'UDHAAR';
    const refund: RefundRow = await this.refunds.insert({
      orderId: order.id,
      idempotencyKey: input.idempotencyKey,
      requestHash,
      amount,
      billGstShare: toMoneyString(result.gstShare),
      settlement: udhaar ? 'KHATA_CREDIT' : 'ORIGINAL_METHOD',
      paymentMethod: order.paymentMethod,
      reason: input.reason,
      actorUserId: viewer.userId,
      lines: {
        createMany: {
          data: result.lines.map((line) => ({
            orderLineId: BigInt(line.lineId),
            quantity: line.quantity,
            amount: toMoneyString(line.amount),
          })),
        },
      },
    });
    const refundedLines = result.lines.map((line) => ({
      lineId: BigInt(line.lineId),
      quantity: line.quantity,
    }));
    await this.refunds.applyToOrder(
      order.id,
      refundedLines,
      amount,
      result.completesOrder ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
    );
    await this.restock(order, refundedLines, refund.id, viewer.userId);
    if (udhaar && order.customerId !== null) {
      await this.customers.postRefundCredit(order.customerId, refund.id, amount, viewer.userId);
    }
    const updated = await this.detail(order.id);
    await this.events.orderRefunded(updated);
    await this.audit.record('sale.refunded', viewer.userId, {
      entityType: 'order',
      entityId: order.id,
      metadata: { amount, lines: refundedLines.length, settlement: refund.settlement },
    });
    return { order: updated, refund, replayed: false };
  }

  /** Refunds always return items to stock (D-14), box lines as quantity × pieces per unit (FIN-16). */
  private async restock(
    order: OrderDetailRow,
    refunded: readonly { lineId: bigint; quantity: number }[],
    refundId: string,
    actorUserId: string,
  ): Promise<void> {
    const byId = new Map(order.lines.map((line) => [line.id, line]));
    const items = refunded.flatMap(({ lineId, quantity }) => {
      const line = byId.get(lineId);
      return line?.productId == null
        ? []
        : [{ productId: line.productId, pieces: quantity * line.piecesPerUnit }];
    });
    await this.saleStock.move('REFUND', { refundId }, items, actorUserId);
  }

  private async detail(orderId: string) {
    const order = await this.orders.findById(orderId);
    if (order === null) {
      throw new AppError('NOT_FOUND', 'This bill does not exist.');
    }
    return toOrderDetailView(order, await this.orders.refundedSoFar(orderId));
  }
}
