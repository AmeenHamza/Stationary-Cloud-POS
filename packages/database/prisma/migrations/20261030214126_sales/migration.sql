-- CreateEnum
CREATE TYPE "discount_type" AS ENUM ('NONE', 'FLAT', 'PERCENT');
-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED');
-- CreateEnum
CREATE TYPE "refund_settlement" AS ENUM ('ORIGINAL_METHOD', 'KHATA_CREDIT');
-- CreateTable
CREATE TABLE "bill_number_counters" (
    "business_date" DATE NOT NULL,
    "last_value" INTEGER NOT NULL,
    CONSTRAINT "bill_number_counters_pkey" PRIMARY KEY ("business_date")
);
-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "bill_number" VARCHAR(24) NOT NULL,
    "business_date" DATE NOT NULL,
    "idempotency_key" UUID NOT NULL,
    "request_hash" BYTEA,
    "cashier_id" UUID,
    "cashier_name" VARCHAR(120) NOT NULL,
    "customer_id" UUID,
    "payment_method" "payment_method" NOT NULL,
    "discount_type" "discount_type" NOT NULL,
    "discount_value" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount_total" DECIMAL(12,2) NOT NULL,
    "product_tax_total" DECIMAL(12,2) NOT NULL,
    "bill_gst_rate" DECIMAL(5,2),
    "bill_gst_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "refunded_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "order_status" NOT NULL DEFAULT 'COMPLETED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "legacy_id" VARCHAR(64),
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "order_lines" (
    "id" BIGSERIAL NOT NULL,
    "order_id" UUID NOT NULL,
    "line_no" SMALLINT NOT NULL,
    "product_id" UUID,
    "product_name" VARCHAR(200) NOT NULL,
    "product_name_urdu" VARCHAR(200),
    "barcode" VARCHAR(64),
    "sale_unit" "sale_unit" NOT NULL,
    "pieces_per_unit" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "tax_rate" DECIMAL(5,2) NOT NULL,
    "line_gross" DECIMAL(12,2) NOT NULL,
    "line_discount" DECIMAL(12,2) NOT NULL,
    "line_net" DECIMAL(12,2) NOT NULL,
    "line_tax" DECIMAL(12,2) NOT NULL,
    "refunded_quantity" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "order_lines_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "idempotency_key" UUID NOT NULL,
    "request_hash" BYTEA,
    "business_date" DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Karachi'::text))::date,
    "amount" DECIMAL(12,2) NOT NULL,
    "bill_gst_share" DECIMAL(12,2) NOT NULL,
    "settlement" "refund_settlement" NOT NULL,
    "payment_method" "payment_method" NOT NULL,
    "reason" VARCHAR(200),
    "actor_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "refund_lines" (
    "id" BIGSERIAL NOT NULL,
    "refund_id" UUID NOT NULL,
    "order_line_id" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "refund_lines_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "orders_bill_number_uq" ON "orders"("bill_number");
-- CreateIndex
CREATE UNIQUE INDEX "orders_idempotency_key_uq" ON "orders"("idempotency_key");
-- CreateIndex
CREATE INDEX "orders_created_idx" ON "orders"("created_at" DESC, "id" DESC);
-- CreateIndex
CREATE INDEX "orders_status_created_idx" ON "orders"("status", "created_at" DESC, "id" DESC);
-- CreateIndex
CREATE INDEX "orders_business_date_idx" ON "orders"("business_date");
-- CreateIndex
CREATE INDEX "orders_customer_created_idx" ON "orders"("customer_id", "created_at" DESC, "id" DESC);
-- CreateIndex
-- The partial prefix index is created in the next migration.
-- CreateIndex
CREATE INDEX "order_lines_product_idx" ON "order_lines"("product_id");
-- CreateIndex
CREATE UNIQUE INDEX "order_lines_order_line_no_uq" ON "order_lines"("order_id", "line_no");
-- CreateIndex
CREATE UNIQUE INDEX "refunds_idempotency_key_uq" ON "refunds"("idempotency_key");
-- CreateIndex
CREATE INDEX "refunds_order_idx" ON "refunds"("order_id", "created_at");
-- CreateIndex
CREATE INDEX "refunds_business_date_idx" ON "refunds"("business_date");
-- CreateIndex
CREATE INDEX "refund_lines_order_line_idx" ON "refund_lines"("order_line_id");
-- CreateIndex
CREATE UNIQUE INDEX "refund_lines_refund_line_uq" ON "refund_lines"("refund_id", "order_line_id");
-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_order_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_refund_fk" FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "customer_ledger_entries" ADD CONSTRAINT "customer_ledger_order_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "customer_ledger_entries" ADD CONSTRAINT "customer_ledger_refund_fk" FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_cashier_fk" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_fk" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_product_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_actor_fk" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "refund_lines" ADD CONSTRAINT "refund_lines_refund_fk" FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "refund_lines" ADD CONSTRAINT "refund_lines_order_line_fk" FOREIGN KEY ("order_line_id") REFERENCES "order_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written constraints Prisma cannot express (DATABASE.md §4.9–4.12). The arithmetic CHECKs make a
-- bill whose total does not equal its components impossible to store (FIN-19).
ALTER TABLE "bill_number_counters" ADD CONSTRAINT "bill_number_counters_value_ck" CHECK ("last_value" > 0);

ALTER TABLE "orders" ADD CONSTRAINT "orders_total_ck" CHECK ("total" = "subtotal" - "discount_total" + "product_tax_total" + "bill_gst_amount");
ALTER TABLE "orders" ADD CONSTRAINT "orders_amounts_ck" CHECK (
  "subtotal" >= 0 AND "discount_total" BETWEEN 0 AND "subtotal" AND "product_tax_total" >= 0
  AND "bill_gst_amount" >= 0 AND "discount_value" >= 0
);
ALTER TABLE "orders" ADD CONSTRAINT "orders_refunded_ck" CHECK ("refunded_total" BETWEEN 0 AND "total");
ALTER TABLE "orders" ADD CONSTRAINT "orders_udhaar_ck" CHECK ("payment_method" <> 'UDHAAR' OR "customer_id" IS NOT NULL);
ALTER TABLE "orders" ADD CONSTRAINT "orders_gst_ck" CHECK (
  ("bill_gst_rate" IS NOT NULL OR "bill_gst_amount" = 0) AND ("bill_gst_rate" IS NULL OR "bill_gst_rate" BETWEEN 0 AND 100)
);
ALTER TABLE "orders" ADD CONSTRAINT "orders_discount_ck" CHECK (
  ("discount_type" <> 'NONE' OR ("discount_value" = 0 AND "discount_total" = 0))
  AND ("discount_type" <> 'PERCENT' OR "discount_value" <= 100)
);
ALTER TABLE "orders" ADD CONSTRAINT "orders_status_ck" CHECK (
  ("status" = 'COMPLETED' AND "refunded_total" = 0)
  OR ("status" = 'PARTIALLY_REFUNDED' AND "refunded_total" > 0)
  OR ("status" = 'REFUNDED' AND "refunded_total" = "total")
);
ALTER TABLE "orders" ADD CONSTRAINT "orders_version_ck" CHECK ("version" >= 1);
ALTER TABLE "orders" ADD CONSTRAINT "orders_bill_number_ck" CHECK ("bill_number" ~ '^ORD-[0-9]{8}-[0-9]{3,}$' OR "legacy_id" IS NOT NULL);
CREATE UNIQUE INDEX "orders_legacy_id_uq" ON "orders"("legacy_id") WHERE "legacy_id" IS NOT NULL;

ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_amounts_ck" CHECK (
  "line_gross" = "unit_price" * "quantity" AND "line_net" = "line_gross" - "line_discount"
  AND "line_discount" BETWEEN 0 AND "line_gross" AND "line_tax" >= 0 AND "unit_price" >= 0
);
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_quantity_ck" CHECK ("quantity" BETWEEN 1 AND 10000 AND "refunded_quantity" BETWEEN 0 AND "quantity");
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_unit_ck" CHECK (("sale_unit" = 'BOX' OR "pieces_per_unit" = 1) AND "pieces_per_unit" >= 1);
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_line_no_ck" CHECK ("line_no" BETWEEN 1 AND 100);
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_tax_rate_ck" CHECK ("tax_rate" BETWEEN 0 AND 100);

ALTER TABLE "refunds" ADD CONSTRAINT "refunds_amounts_ck" CHECK ("amount" > 0 AND "bill_gst_share" >= 0 AND "bill_gst_share" <= "amount");
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_settlement_ck" CHECK (("payment_method" = 'UDHAAR') = ("settlement" = 'KHATA_CREDIT'));
ALTER TABLE "refund_lines" ADD CONSTRAINT "refund_lines_amounts_ck" CHECK ("quantity" > 0 AND "amount" >= 0);
