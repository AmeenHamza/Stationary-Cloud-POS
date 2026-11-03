import { Module } from '@nestjs/common';

import { AuditModule } from '../audit';
import { CatalogModule } from '../catalog';
import { KhataModule } from '../khata';
import { SettingsModule } from '../settings';

import { CreateSaleService } from './application/create-sale.service';
import { OrderQueriesService } from './application/order-queries.service';
import { ReceiptBuilder } from './application/receipt.builder';
import { RefundOrderService } from './application/refund-order.service';
import { SaleEvents } from './application/sale-events';
import { OrdersResolver } from './graphql/orders.resolver';
import { SalesResolver } from './graphql/sales.resolver';
import { BillCounterRepository } from './persistence/bill-counter.repository';
import { OrderListRepository } from './persistence/order-list.repository';
import { OrdersRepository } from './persistence/orders.repository';
import { RefundsRepository } from './persistence/refunds.repository';

// The event payload types are reached only through the `ShopEvent` interface, so load them here.
import './graphql/sale-events.types';

/**
 * Billing, receipts, order history and refunds (F-15, F-16, F-19–F-23, F-33, F-34). Stock moves
 * through the catalogue's stock ledger and Udhaar through the khata, inside the same transaction.
 */
@Module({
  imports: [AuditModule, CatalogModule, KhataModule, SettingsModule],
  providers: [
    SalesResolver,
    OrdersResolver,
    CreateSaleService,
    RefundOrderService,
    OrderQueriesService,
    ReceiptBuilder,
    SaleEvents,
    BillCounterRepository,
    OrdersRepository,
    OrderListRepository,
    RefundsRepository,
  ],
})
export class SalesModule {}
