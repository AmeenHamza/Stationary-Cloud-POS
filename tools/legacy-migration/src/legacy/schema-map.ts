/**
 * The old system's tables and the columns the migration reads (Q27, MAPPING.md §2). This is the only
 * file that names old tables or columns. It was checked against the real old database on 2026-11-10;
 * `pnpm migrate check` compares it with the database again and lists the actual columns of any table
 * that differs. Every column here is required: a missing one stops the run instead of being skipped.
 */
export interface LegacyColumn {
  column: string;
  /** Timestamps are read as UTC instants (see LEGACY_NAIVE_TIMESTAMPS). */
  timestamp?: boolean;
}

export interface LegacyTable {
  table: string;
  columns: Readonly<Record<string, LegacyColumn>>;
}

const col = (column: string): LegacyColumn => ({ column });
const time = (column: string): LegacyColumn => ({ column, timestamp: true });

export const LEGACY = {
  categories: {
    table: 'categories',
    columns: {
      id: col('id'),
      name: col('name'),
      description: col('description'),
      createdAt: time('created_at'),
    },
  },
  products: {
    table: 'products',
    columns: {
      id: col('id'),
      barcode: col('barcode'),
      name: col('name'),
      nameUrdu: col('name_urdu'),
      price: col('price'),
      cost: col('cost'),
      stock: col('stock'),
      lowStockThreshold: col('low_stock_threshold'),
      lowStockUnit: col('low_stock_threshold_unit'),
      taxRate: col('tax_rate'),
      baseUnit: col('base_unit_name'),
      piecesPerBox: col('pieces_per_box'),
      boxPrice: col('box_price'),
      categoryId: col('category_id'),
      isActive: col('is_active'),
      createdAt: time('created_at'),
      updatedAt: time('updated_at'),
    },
  },
  customers: {
    table: 'customers',
    columns: {
      id: col('id'),
      name: col('name'),
      phone: col('phone'),
      email: col('email'),
      address: col('address'),
      createdAt: time('created_at'),
    },
  },
  vendors: {
    table: 'vendors',
    columns: {
      id: col('id'),
      name: col('name'),
      phone: col('phone'),
      email: col('email'),
      address: col('address'),
      productsSupplied: col('products'),
      createdAt: time('created_at'),
    },
  },
  customerTransactions: {
    table: 'customer_transactions',
    columns: {
      id: col('id'),
      customerId: col('customer_id'),
      type: col('type'),
      amount: col('amount'),
      description: col('description'),
      paymentMethod: col('payment_method'),
      orderId: col('order_id'),
      createdAt: time('created_at'),
    },
  },
  vendorTransactions: {
    table: 'vendor_transactions',
    columns: {
      id: col('id'),
      vendorId: col('vendor_id'),
      type: col('type'),
      amount: col('amount'),
      description: col('description'),
      paymentMethod: col('payment_method'),
      createdAt: time('created_at'),
    },
  },
  orders: {
    table: 'orders',
    columns: {
      id: col('id'),
      orderNumber: col('order_number'),
      createdAt: time('created_at'),
      totalAmount: col('total_amount'),
      discountAmount: col('discount_amount'),
      discountType: col('discount_type'),
      discountValue: col('discount_value'),
      taxAmount: col('tax_amount'),
      billGstApplied: col('bill_gst_enabled'),
      billGstPercentage: col('bill_gst_percentage'),
      billGstAmount: col('bill_gst_amount'),
      /** The amount charged after discount, product tax and Bill GST (= the bill's payment). */
      finalAmount: col('net_amount'),
      paymentMethod: col('payment_method'),
      status: col('status'),
      refundedAmount: col('refunded_amount'),
      customerId: col('customer_id'),
      cashierId: col('cashier_id'),
    },
  },
  orderItems: {
    table: 'order_items',
    columns: {
      id: col('id'),
      orderId: col('order_id'),
      productId: col('product_id'),
      productName: col('product_name'),
      quantity: col('quantity'),
      unitPrice: col('unit_price'),
      discount: col('discount'),
      taxAmount: col('tax_amount'),
      saleUnit: col('sale_unit'),
      piecesPerUnit: col('pieces_per_unit'),
      refundedQuantity: col('refunded_quantity'),
    },
  },
  orderPayments: {
    table: 'order_payments',
    columns: {
      id: col('id'),
      orderId: col('order_id'),
      paymentMethod: col('payment_method'),
      amount: col('amount'),
    },
  },
  users: { table: 'users', columns: { id: col('id'), fullName: col('full_name') } },
  systemSettings: {
    table: 'system_settings',
    columns: { id: col('id'), key: col('key'), value: col('value') },
  },
} as const satisfies Record<string, LegacyTable>;

export type LegacyEntity = keyof typeof LEGACY;
export type FieldOf<E extends LegacyEntity> = keyof (typeof LEGACY)[E]['columns'];
/** One old row: every mapped field as text (or null), read with `::text` to avoid float surprises. */
export type LegacyRow<E extends LegacyEntity> = Readonly<Record<FieldOf<E>, string | null>>;
