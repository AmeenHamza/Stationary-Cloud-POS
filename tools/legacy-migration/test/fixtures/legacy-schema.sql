-- The old system's public schema as it is in production (MAPPING.md §2, read 2026-11-10): the same
-- tables, columns, types, keys and indexes, with no data. MIG-01–MIG-05 build their fixture from it.

CREATE TABLE users (
  id serial PRIMARY KEY,
  full_name varchar,
  username varchar,
  email varchar,
  hashed_password varchar,
  role varchar,
  is_active boolean,
  phone varchar,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX ix_users_username ON users (username);
CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE TABLE categories (
  id serial PRIMARY KEY,
  name varchar,
  description varchar,
  icon varchar,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX ix_categories_name ON categories (name);

CREATE TABLE products (
  id serial PRIMARY KEY,
  barcode varchar,
  name varchar,
  name_urdu varchar,
  description varchar,
  price double precision,
  cost double precision,
  stock integer,
  low_stock_threshold integer,
  low_stock_threshold_unit varchar,
  tax_rate double precision,
  base_unit_name varchar,
  pieces_per_box integer,
  box_price double precision,
  expiry_date date,
  expiry_alert_days integer,
  category_id integer REFERENCES categories (id),
  is_active boolean,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX ix_products_barcode ON products (barcode);
CREATE INDEX ix_products_name ON products (name);

CREATE TABLE customers (
  id serial PRIMARY KEY,
  name varchar,
  phone varchar,
  email varchar,
  loyalty_points integer,
  total_purchases double precision,
  created_at timestamptz DEFAULT now(),
  address varchar
);
CREATE UNIQUE INDEX ix_customers_phone ON customers (phone);

CREATE TABLE vendors (
  id serial PRIMARY KEY,
  name varchar,
  phone varchar,
  email varchar,
  address varchar,
  products varchar,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX ix_vendors_phone ON vendors (phone);

CREATE TABLE orders (
  id serial PRIMARY KEY,
  order_number varchar,
  created_at timestamptz DEFAULT now(),
  total_amount double precision,
  discount_amount double precision,
  discount_type varchar,
  discount_value double precision,
  discount_reason varchar,
  tax_amount double precision,
  bill_gst_enabled boolean,
  bill_gst_percentage double precision,
  bill_gst_amount double precision,
  net_amount double precision,
  payment_method varchar,
  status varchar,
  refunded_amount double precision,
  customer_id integer REFERENCES customers (id),
  cashier_id integer REFERENCES users (id),
  fbr_irn varchar,
  fbr_qr_code varchar,
  is_synced_with_fbr boolean,
  notes varchar
);
CREATE UNIQUE INDEX ix_orders_order_number ON orders (order_number);
CREATE UNIQUE INDEX ix_orders_fbr_irn ON orders (fbr_irn);

CREATE TABLE order_items (
  id serial PRIMARY KEY,
  order_id integer REFERENCES orders (id),
  product_id integer REFERENCES products (id),
  product_name varchar,
  quantity integer,
  unit_price double precision,
  discount double precision,
  tax_amount double precision,
  total double precision,
  sale_unit varchar,
  pieces_per_unit integer,
  refunded_quantity integer
);

CREATE TABLE order_payments (
  id serial PRIMARY KEY,
  order_id integer REFERENCES orders (id),
  payment_method varchar,
  amount double precision
);

CREATE TABLE customer_transactions (
  id serial PRIMARY KEY,
  customer_id integer REFERENCES customers (id),
  type varchar,
  amount double precision,
  description varchar,
  payment_method varchar,
  order_id integer REFERENCES orders (id),
  created_by integer REFERENCES users (id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE vendor_transactions (
  id serial PRIMARY KEY,
  vendor_id integer REFERENCES vendors (id),
  type varchar,
  amount double precision,
  description varchar,
  payment_method varchar,
  created_by integer REFERENCES users (id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE system_settings (
  id serial PRIMARY KEY,
  key varchar,
  value varchar,
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX ix_system_settings_key ON system_settings (key);
