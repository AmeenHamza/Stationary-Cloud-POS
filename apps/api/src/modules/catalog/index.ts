export { CatalogModule } from './catalog.module';
export { SaleStockService } from './inventory/application/sale-stock.service';
export {
  ProductImportService,
  type ImportedProduct,
} from './products/application/product-import.service';
export {
  EXPORT_BATCH_SIZE,
  ProductExportReader,
} from './products/persistence/product-export.reader';
export type { SaleProductRow } from './inventory/persistence/stock.repository';
export type { ProductView } from './products/application/product-view';
