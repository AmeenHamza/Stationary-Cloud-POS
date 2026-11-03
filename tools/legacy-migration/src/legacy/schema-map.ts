/**
 * The old system's tables and the columns the migration reads (Q27, DATABASE.md §11). This is the
 * only file that names old tables or columns. It was written from the owner's screenshots of the old
 * Neon project (2026-11-01); names marked `cut` were cut off there and are best readings. `pnpm
 * migrate --check` compares this map with the real database and lists the actual columns of any
 * table whose names differ. `optional` columns may be missing; the migration then does without.
 */
export interface LegacyColumn {
  column: string;
  optional?: boolean;
  /** Timestamps are read as UTC instants (see LEGACY_NAIVE_TIMESTAMPS). */
  timestamp?: boolean;
  /** The header was cut off in the screenshot: the name is a best reading. */
  cut?: boolean;
}

export interface LegacyTable {
  table: string;
  columns: Readonly<Record<string, LegacyColumn>>;
}

const col = (column: string, flags: Omit<LegacyColumn, 'column'> = {}): LegacyColumn => ({
  column,
  ...flags,
});
const cut = (column: string, flags: Omit<LegacyColumn, 'column' | 'cut'> = {}): LegacyColumn =>
  col(column, { ...flags, cut: true });

export const LEGACY = {
  categories: {
    table: 'categories',
    columns: { id: col('id'), name: col('name'), description: col('description') },
  },
  products: {
    table: 'products',
    columns: {
      id: col('id'),
      barcode: cut('barcode'),
      name: col('name'),
      nameUrdu: cut('name_urdu'),
      price: col('price'),
      cost: col('cost'),
      stock: col('stock'),
      lowStockThreshold: cut('low_stock_threshold'),
      lowStockUnit: cut('low_stock_unit', { optional: true }),
      taxRate: cut('tax_rate'),
      baseUnit: cut('base_unit', { optional: true }),
      piecesPerBox: cut('pieces_per_box'),
      boxPrice: cut('box_price', { optional: true }),
      categoryId: cut('category_id'),
      isActive: cut('is_active'),
    },
  },
  customers: {
    table: 'customers',
    columns: {
      id: col('id'),
      name: col('name'),
      phone: col('phone'),
      email: col('email'),
      address: cut('address'),
    },
  },
  vendors: {
    table: 'vendors',
    columns: {
      id: col('id'),
      name: col('name'),
      phone: col('phone'),
      email: col('email'),
      address: cut('address'),
      productsSupplied: cut('products_supplied', { optional: true }),
    },
  },
  customerTransactions: {
    table: 'customer_transactions',
    columns: {
      id: col('id'),
      customerId: cut('customer_id'),
      type: col('type'),
      amount: cut('amount'),
      description: cut('description'),
      paymentMethod: cut('payment_method'),
      orderId: cut('order_id'),
      createdAt: cut('created_at', { timestamp: true }),
    },
  },
  vendorTransactions: {
    table: 'vendor_transactions',
    columns: {
      id: col('id'),
      vendorId: col('vendor_id'),
      type: col('type'),
      amount: cut('amount'),
      description: cut('description'),
      paymentMethod: cut('payment_method'),
      createdAt: cut('created_at', { timestamp: true }),
    },
  },
  orders: {
    table: 'orders',
    columns: {
      id: col('id'),
      orderNumber: cut('order_number'),
      createdAt: cut('created_at', { timestamp: true }),
      totalAmount: cut('total_amount', { optional: true }),
      discountAmount: cut('discount_amount'),
      discountType: cut('discount_type'),
      discountValue: cut('discount_value'),
      taxAmount: cut('tax_amount', { optional: true }),
      billGstApplied: cut('bill_gst_applied', { optional: true }),
      billGstPercentage: cut('bill_gst_percentage', { optional: true }),
      billGstAmount: cut('bill_gst_amount', { optional: true }),
      /** The amount charged after discount and GST; hidden in the screenshot. */
      finalAmount: cut('final_amount', { optional: true }),
      paymentMethod: cut('payment_method'),
      status: col('status'),
      refundedAmount: cut('refunded_amount'),
      customerId: cut('customer_id'),
      cashierId: cut('cashier_id'),
    },
  },
  orderItems: {
    table: 'order_items',
    columns: {
      id: col('id'),
      orderId: cut('order_id'),
      productId: cut('product_id'),
      productName: cut('product_name'),
      quantity: cut('quantity'),
      unitPrice: cut('unit_price'),
      discount: cut('discount'),
      taxAmount: cut('tax_amount'),
      saleUnit: cut('sale_unit'),
      piecesPerUnit: col('pieces_per_unit'),
      refundedQuantity: col('refunded_quantity'),
    },
  },
  orderPayments: {
    table: 'order_payments',
    columns: {
      id: col('id'),
      orderId: cut('order_id'),
      paymentMethod: cut('payment_method'),
      amount: cut('amount'),
    },
  },
  users: { table: 'users', columns: { id: col('id'), fullName: cut('full_name') } },
  systemSettings: {
    table: 'system_settings',
    columns: { id: col('id'), key: col('key'), value: col('value') },
  },
} as const satisfies Record<string, LegacyTable>;

export type LegacyEntity = keyof typeof LEGACY;
export type FieldOf<E extends LegacyEntity> = keyof (typeof LEGACY)[E]['columns'];
/** One old row: every mapped field as text (or null), read with `::text` to avoid float surprises. */
export type LegacyRow<E extends LegacyEntity> = Readonly<Record<FieldOf<E>, string | null>>;
