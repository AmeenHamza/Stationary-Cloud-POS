-- Invented data in the old schema (no real shop, customer or vendor). It covers each case MAPPING.md §9
-- found in production. Expected results are listed in test/fixture-expectations.ts.

INSERT INTO users (id, full_name, username, role, is_active) VALUES
  (1, 'Owner One', 'owner', 'admin', true),
  (2, 'Till One', 'till', 'cashier', true);

INSERT INTO system_settings (key, value) VALUES
  ('bill_gst_percentage', '18.0'),
  ('groq_api_key', 'placeholder-not-a-key');

-- 'pens' repeats 'Pens' ignoring case: merged into it.
INSERT INTO categories (id, name, created_at) VALUES
  (1, 'Pens', '2026-07-07 10:00:00.123456+05'),
  (2, 'Paper', '2026-07-08 10:00:00+05'),
  (3, 'pens', '2026-07-09 10:00:00+05');

-- 2: barcode with spaces, box threshold. 3: same barcode once trimmed (Q35). 4: barcode over 64
-- characters. 5: no barcode and no cost. 6: never sold, stock 0.
INSERT INTO products (id, barcode, name, price, cost, stock, low_stock_threshold,
  low_stock_threshold_unit, tax_rate, base_unit_name, pieces_per_box, category_id, is_active,
  created_at, updated_at) VALUES
  (1, '111', 'Blue Pen', 20, 12, 100, 10, 'piece', 0, 'Piece', 1, 1, true,
   '2026-09-23 09:00:00.987654+05', '2026-10-01 09:00:00+05'),
  (2, ' 222 ', 'Notebook', 150, 100, 40, 2, 'box', 0, 'Piece', 12, 2, true,
   '2026-09-24 09:00:00+05', '2026-09-24 09:00:00+05'),
  (3, '222', 'Red Pen', 20, 12, 7, 10, 'piece', 0, 'Piece', 1, 3, true,
   '2026-09-25 09:00:00+05', '2026-09-25 09:00:00+05'),
  (4, repeat('X', 70), 'Long Code Item', 50, 30, 3, 1, 'piece', 0, 'Piece', 1, NULL, true,
   '2026-09-26 09:00:00+05', '2026-09-26 09:00:00+05'),
  (5, NULL, 'Marker', 120, NULL, 5, 2, 'piece', 0, 'Piece', 1, 1, true,
   '2026-09-27 09:00:00+05', '2026-09-27 09:00:00+05'),
  (6, '666', 'Ruler', 40, 25, 0, 5, 'piece', 0, 'Piece', 1, 2, true,
   '2026-09-28 09:00:00+05', '2026-09-28 09:00:00+05');

INSERT INTO customers (id, name, phone, loyalty_points, total_purchases, created_at) VALUES
  (1, 'Customer A', '0000-0000001', 12, 90, '2026-10-06 12:00:00+05'),
  (2, 'Customer B', '0000-0000002', 0, 60, '2026-10-07 12:00:00+05');

INSERT INTO vendors (id, name, phone, products, created_at) VALUES
  (1, 'Vendor A', '0000-0000101', 'Paper', '2026-10-05 12:00:00+05'),
  (2, 'Vendor B', '0000-0000102', NULL, '2026-10-05 13:00:00+05');

-- 1 flat discount · 2 Udhaar with 10 % · 3 a 13 % taxed item and a deleted product · 4 refunded in full
-- · 5 refunded in part · 6 Udhaar refunded in full.
INSERT INTO orders (id, order_number, created_at, total_amount, discount_amount, discount_type,
  discount_value, tax_amount, bill_gst_enabled, bill_gst_percentage, bill_gst_amount, net_amount,
  payment_method, status, refunded_amount, customer_id, cashier_id, fbr_irn, is_synced_with_fbr) VALUES
  (1, 'ORD-20261030-001', '2026-10-30 10:00:00.555555+05', 190, 10, 'flat', 10, 0, false, 0, 0, 180,
   'cash', 'completed', 0, NULL, 2, 'irn-1', true),
  (2, 'ORD-20261030-002', '2026-10-30 11:00:00+05', 100, 10, 'percentage', 10, 0, false, 0, 0, 90,
   'udhaar', 'completed', 0, 1, 2, 'irn-2', true),
  (3, 'ORD-20261031-001', '2026-10-31 09:30:00+05', 150, 0, NULL, 0, 15.600000000000001, false, 0, 0,
   165.6, 'card', 'completed', 0, NULL, 1, 'irn-3', true),
  (4, 'ORD-20261031-002', '2026-10-31 10:00:00+05', 20, 0, NULL, 0, 0, false, 0, 0, 20,
   'cash', 'refunded', 20, NULL, 2, 'irn-4', true),
  (5, 'ORD-20261031-003', '2026-10-31 11:00:00+05', 190, 19, 'flat', 19, 0, false, 0, 0, 171,
   'cash', 'partially_refunded', 135, NULL, 2, 'irn-5', true),
  (6, 'ORD-20261101-001', '2026-11-01 12:00:00+05', 60, 0, NULL, 0, 0, false, 0, 0, 60,
   'udhaar', 'refunded', 60, 2, 2, 'irn-6', true);

INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, discount,
  tax_amount, total, sale_unit, pieces_per_unit, refunded_quantity) VALUES
  (1, 1, 'Blue Pen', 2, 20, 0, 0, 40, 'piece', 1, 0),
  (1, 2, 'Notebook', 1, 150, 0, 0, 150, 'piece', 1, 0),
  (2, 1, 'Blue Pen', 5, 20, 0, 0, 100, 'piece', 1, 0),
  (3, 5, 'Marker', 1, 120, 0, 15.600000000000001, 120, 'piece', 1, 0),
  (3, NULL, 'Gift Wrap', 1, 30, 0, 0, 30, 'piece', 1, 0),
  (4, 1, 'Blue Pen', 1, 20, 0, 0, 20, 'piece', 1, 1),
  (5, 1, 'Blue Pen', 2, 20, 0, 0, 40, 'piece', 1, 0),
  (5, 2, 'Notebook', 1, 150, 0, 0, 150, 'piece', 1, 1),
  (6, 1, 'Blue Pen', 3, 20, 0, 0, 60, 'piece', 1, 3);

INSERT INTO order_payments (order_id, payment_method, amount)
  SELECT id, payment_method, net_amount FROM orders ORDER BY id;

INSERT INTO customer_transactions (customer_id, type, amount, description, payment_method, order_id,
  created_by, created_at) VALUES
  (1, 'debit', 500, 'Udhaar before the bill history was cleared', NULL, NULL, 1, '2026-10-20 15:00:00+05'),
  (1, 'debit', 90, NULL, NULL, 2, 2, '2026-10-30 11:00:00+05'),
  (1, 'credit', 200, 'Paid at the counter', 'cash', NULL, 2, '2026-11-02 10:00:00+05'),
  (1, 'credit', 100, 'Paid', NULL, NULL, 2, '2026-11-03 10:00:00+05'),
  (1, 'debit', 0, 'Nothing', NULL, NULL, 2, '2026-11-03 11:00:00+05'),
  (2, 'debit', 60, NULL, NULL, 6, 2, '2026-11-01 12:00:00+05'),
  (2, 'credit', 60, 'Refund', NULL, 6, 2, '2026-11-04 16:00:00+05');

INSERT INTO vendor_transactions (vendor_id, type, amount, description, payment_method, created_by,
  created_at) VALUES
  (1, 'purchase', 1000, 'Paper stock', NULL, 1, '2026-10-05 14:00:00+05'),
  (1, 'payment', 400, NULL, 'bank_transfer', 1, '2026-10-10 14:00:00+05'),
  (2, 'purchase', 300, 'Pens', NULL, 1, '2026-10-06 14:00:00+05');

SELECT setval('orders_id_seq', 6);
