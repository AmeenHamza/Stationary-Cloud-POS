/**
 * Twelve months of bills (NETWORK_OPTIMIZATION.md §8.1), generated inside PostgreSQL in one session
 * after `setseed`, so every run builds the same history. Bills satisfy every CHECK of the sales
 * tables: no discount or Bill GST, product tax per line, Udhaar bills on a customer's khata with
 * running balances. History sales move no stock (the catalogue has opening stock only); refunds
 * and restocks happen in the simulated day.
 *
 * Each statement lists the parameters it binds, in order ($1, $2, …).
 */
export type HistoryParameter = 'days' | 'billsPerDay' | 'udhaarShare';

export const HISTORY_SQL: readonly (readonly [string, readonly HistoryParameter[]])[] = [
  [
    `CREATE TEMP TABLE perf_products AS
     SELECT row_number() OVER (ORDER BY barcode) AS rn, id, name, name_urdu, barcode, sale_price, tax_rate
     FROM products`,
    [],
  ],
  [
    `CREATE TEMP TABLE perf_customers AS
     SELECT row_number() OVER (ORDER BY name) AS rn, id FROM customers`,
    [],
  ],
  [
    `CREATE TEMP TABLE perf_bills AS
     SELECT gen_random_uuid() AS id, d::date AS business_date, n AS seq, random() AS r_method,
            random() AS r_customer,
            least(6, 1 + floor(random() * 5)::int + (random() < 0.2)::int) AS line_count,
            ((d::date + time '10:00' + n * interval '12 minutes') AT TIME ZONE 'Asia/Karachi')
              AS created_at,
            CASE WHEN n % 2 = 0 THEN 'Perf Counter A' ELSE 'Perf Counter B' END AS cashier_name
     FROM generate_series((now() AT TIME ZONE 'Asia/Karachi')::date - $1::int,
                          (now() AT TIME ZONE 'Asia/Karachi')::date - 1, interval '1 day') AS d,
          generate_series(1, $2::int) AS n`,
    ['days', 'billsPerDay'],
  ],
  [
    `CREATE TEMP TABLE perf_line_amounts AS
     WITH picks AS (
       SELECT b.id AS order_id, l AS line_no,
              1 + floor(random() * (SELECT count(*) FROM perf_products))::int AS rn,
              1 + floor(random() * 3)::int AS quantity
       FROM perf_bills b CROSS JOIN LATERAL generate_series(1, b.line_count) AS l)
     SELECT k.order_id, k.line_no, p.id AS product_id, p.name, p.name_urdu, p.barcode, k.quantity,
            p.sale_price AS unit_price, p.tax_rate, p.sale_price * k.quantity AS line_gross,
            round(p.sale_price * k.quantity * p.tax_rate / 100, 2) AS line_tax
     FROM picks k JOIN perf_products p ON p.rn = k.rn`,
    [],
  ],
  [
    `INSERT INTO orders (id, bill_number, business_date, idempotency_key, cashier_name, customer_id,
                       payment_method, discount_type, discount_value, subtotal, discount_total,
                       product_tax_total, bill_gst_amount, total, created_at)
   SELECT b.id, 'ORD-' || to_char(b.business_date, 'YYYYMMDD') || '-' || lpad(b.seq::text, 3, '0'),
          b.business_date, gen_random_uuid(), b.cashier_name,
          CASE WHEN m.method = 'UDHAAR' THEN c.id END, m.method::payment_method, 'NONE', 0,
          a.subtotal, 0, a.tax, 0, a.subtotal + a.tax, b.created_at
   FROM perf_bills b
   CROSS JOIN LATERAL (SELECT CASE
       WHEN b.r_method < $1::float8 THEN 'UDHAAR'
       WHEN b.r_method < $1::float8 + 0.10 THEN 'CARD'
       WHEN b.r_method < $1::float8 + 0.18 THEN 'EASYPAISA'
       WHEN b.r_method < $1::float8 + 0.23 THEN 'JAZZCASH'
       WHEN b.r_method < $1::float8 + 0.25 THEN 'BANK_TRANSFER'
       ELSE 'CASH' END AS method) m
   JOIN (SELECT order_id, sum(line_gross) AS subtotal, sum(line_tax) AS tax
         FROM perf_line_amounts GROUP BY order_id) a ON a.order_id = b.id
   JOIN perf_customers c
     ON c.rn = 1 + floor(b.r_customer * (SELECT count(*) FROM perf_customers))::int`,
    ['udhaarShare'],
  ],
  [
    `INSERT INTO order_lines (order_id, line_no, product_id, product_name, product_name_urdu, barcode,
                            sale_unit, pieces_per_unit, quantity, unit_price, tax_rate, line_gross,
                            line_discount, line_net, line_tax)
   SELECT order_id, line_no, product_id, name, name_urdu, barcode, 'PIECE', 1, quantity, unit_price,
          tax_rate, line_gross, 0, line_gross, line_tax
   FROM perf_line_amounts`,
    [],
  ],
  [
    `INSERT INTO bill_number_counters (business_date, last_value)
   SELECT business_date, max(seq) FROM perf_bills GROUP BY business_date`,
    [],
  ],
  [
    `INSERT INTO customer_ledger_entries (customer_id, type, amount, balance_after, order_id,
                                        business_date, created_at)
   SELECT customer_id, 'CREDIT_SALE', total,
          sum(total) OVER (PARTITION BY customer_id ORDER BY created_at, id), id, business_date,
          created_at
   FROM orders WHERE payment_method = 'UDHAAR'`,
    [],
  ],
  [
    `UPDATE customers c SET balance = s.balance
   FROM (SELECT customer_id, sum(amount) AS balance FROM customer_ledger_entries GROUP BY 1) s
   WHERE s.customer_id = c.id`,
    [],
  ],
  [
    `WITH purchases AS (
     SELECT v.id AS vendor_id, m::date AS day, round((5000 + random() * 45000)::numeric, 2) AS amount
     FROM vendors v,
          generate_series((now() AT TIME ZONE 'Asia/Karachi')::date - $1::int,
                          (now() AT TIME ZONE 'Asia/Karachi')::date - 1, interval '1 month') AS m)
   INSERT INTO vendor_ledger_entries (vendor_id, type, amount, balance_after, business_date)
   SELECT vendor_id, 'PURCHASE', amount,
          sum(amount) OVER (PARTITION BY vendor_id ORDER BY day), day
   FROM purchases`,
    ['days'],
  ],
  [
    `UPDATE vendors v SET balance = s.balance
   FROM (SELECT vendor_id, sum(amount) AS balance FROM vendor_ledger_entries GROUP BY 1) s
   WHERE s.vendor_id = v.id`,
    [],
  ],
  ['ANALYZE', []],
];
