import { Module } from '@nestjs/common';

import { AuditModule } from '../audit';

// The event payload types are only reached through the `ShopEvent` interface, so load them here.
import './catalog-events.types';
import { CategoryCommandsService } from './categories/application/category-commands.service';
import { CategoryQueriesService } from './categories/application/category-queries.service';
import { CategoryResolver } from './categories/graphql/category.resolver';
import { CategoriesRepository } from './categories/persistence/categories.repository';
import { AdjustStockService } from './inventory/application/adjust-stock.service';
import { RestockService } from './inventory/application/restock.service';
import { SaleStockService } from './inventory/application/sale-stock.service';
import { StockLedgerService } from './inventory/application/stock-ledger.service';
import { InventoryResolver } from './inventory/graphql/inventory.resolver';
import { StockRepository } from './inventory/persistence/stock.repository';
import { ArchiveProductService } from './products/application/archive-product.service';
import { CloneProductService } from './products/application/clone-product.service';
import { CreateProductService } from './products/application/create-product.service';
import { DeleteProductService } from './products/application/delete-product.service';
import { NewProductRecorder } from './products/application/new-product-recorder';
import { ProductEvents } from './products/application/product-events';
import { ProductImportService } from './products/application/product-import.service';
import { ProductQueriesService } from './products/application/product-queries.service';
import { UpdateProductService } from './products/application/update-product.service';
import { ProductCommandsResolver } from './products/graphql/product-commands.resolver';
import { ProductQueriesResolver } from './products/graphql/product-queries.resolver';
import { ProductExportReader } from './products/persistence/product-export.reader';
import { ProductListRepository } from './products/persistence/product-list.repository';
import { ProductsRepository } from './products/persistence/products.repository';

/** Categories, products, stock and low-stock alerts (F-08–F-13, F-32). */
@Module({
  imports: [AuditModule],
  providers: [
    CategoryResolver,
    CategoryQueriesService,
    CategoryCommandsService,
    CategoriesRepository,
    ProductQueriesResolver,
    ProductCommandsResolver,
    ProductQueriesService,
    CreateProductService,
    UpdateProductService,
    CloneProductService,
    ArchiveProductService,
    DeleteProductService,
    NewProductRecorder,
    ProductImportService,
    ProductEvents,
    ProductsRepository,
    ProductListRepository,
    ProductExportReader,
    InventoryResolver,
    RestockService,
    AdjustStockService,
    StockLedgerService,
    SaleStockService,
    StockRepository,
  ],
  exports: [SaleStockService, ProductImportService, ProductExportReader],
})
export class CatalogModule {}
