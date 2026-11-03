-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('CASH', 'CARD', 'EASYPAISA', 'JAZZCASH', 'BANK_TRANSFER', 'UDHAAR');

-- CreateEnum
CREATE TYPE "customer_entry_type" AS ENUM ('OPENING_BALANCE', 'CREDIT_SALE', 'MANUAL_CREDIT', 'PAYMENT', 'REFUND_CREDIT');

-- CreateEnum
CREATE TYPE "vendor_entry_type" AS ENUM ('OPENING_BALANCE', 'PURCHASE', 'PAYMENT');

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "name_key" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(30),
    "phone_digits" VARCHAR(20),
    "email" VARCHAR(254),
    "address" VARCHAR(300),
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "legacy_id" VARCHAR(64),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "name_key" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(30),
    "phone_digits" VARCHAR(20),
    "email" VARCHAR(254),
    "address" VARCHAR(300),
    "products_supplied" VARCHAR(300),
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "legacy_id" VARCHAR(64),

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_ledger_entries" (
    "id" BIGSERIAL NOT NULL,
    "customer_id" UUID NOT NULL,
    "type" "customer_entry_type" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balance_after" DECIMAL(12,2) NOT NULL,
    "payment_method" "payment_method",
    "note" VARCHAR(300),
    "order_id" UUID,
    "refund_id" UUID,
    "idempotency_key" UUID,
    "request_hash" BYTEA,
    "business_date" DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Karachi'::text))::date,
    "actor_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_id" VARCHAR(64),

    CONSTRAINT "customer_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_ledger_entries" (
    "id" BIGSERIAL NOT NULL,
    "vendor_id" UUID NOT NULL,
    "type" "vendor_entry_type" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balance_after" DECIMAL(12,2) NOT NULL,
    "payment_method" "payment_method",
    "note" VARCHAR(300),
    "idempotency_key" UUID,
    "request_hash" BYTEA,
    "business_date" DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Karachi'::text))::date,
    "actor_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacy_id" VARCHAR(64),

    CONSTRAINT "vendor_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customers_name_key_trgm_idx" ON "customers" USING GIN ("name_key" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "vendors_name_key_trgm_idx" ON "vendors" USING GIN ("name_key" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "customer_ledger_idempotency_key_uq" ON "customer_ledger_entries"("idempotency_key");

-- CreateIndex
CREATE INDEX "customer_ledger_customer_created_idx" ON "customer_ledger_entries"("customer_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_ledger_idempotency_key_uq" ON "vendor_ledger_entries"("idempotency_key");

-- CreateIndex
CREATE INDEX "vendor_ledger_vendor_created_idx" ON "vendor_ledger_entries"("vendor_id", "created_at" DESC, "id" DESC);

-- AddForeignKey
ALTER TABLE "customer_ledger_entries" ADD CONSTRAINT "customer_ledger_customer_fk" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_ledger_entries" ADD CONSTRAINT "customer_ledger_actor_fk" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_ledger_entries" ADD CONSTRAINT "vendor_ledger_vendor_fk" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_ledger_entries" ADD CONSTRAINT "vendor_ledger_actor_fk" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written constraints Prisma cannot express (DATABASE.md §4.7–4.8)
ALTER TABLE "customers" ADD CONSTRAINT "customers_name_ck" CHECK (char_length("name") BETWEEN 1 AND 120 AND char_length("name_key") >= 1);
ALTER TABLE "customers" ADD CONSTRAINT "customers_version_ck" CHECK ("version" >= 1);
CREATE UNIQUE INDEX "customers_legacy_id_uq" ON "customers"("legacy_id") WHERE "legacy_id" IS NOT NULL;
CREATE INDEX "customers_active_name_idx" ON "customers"("name_key", "id") WHERE "archived_at" IS NULL;
CREATE INDEX "customers_phone_digits_idx" ON "customers"("phone_digits") WHERE "phone_digits" IS NOT NULL;

ALTER TABLE "vendors" ADD CONSTRAINT "vendors_name_ck" CHECK (char_length("name") BETWEEN 1 AND 120 AND char_length("name_key") >= 1);
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_version_ck" CHECK ("version" >= 1);
CREATE UNIQUE INDEX "vendors_legacy_id_uq" ON "vendors"("legacy_id") WHERE "legacy_id" IS NOT NULL;
CREATE INDEX "vendors_active_name_idx" ON "vendors"("name_key", "id") WHERE "archived_at" IS NULL;
CREATE INDEX "vendors_phone_digits_idx" ON "vendors"("phone_digits") WHERE "phone_digits" IS NOT NULL;

-- Customer ledger: sign per entry type (+ raises what the customer owes), required references, and a
-- payment method only on payments, never Udhaar (DATABASE.md §4.8).
ALTER TABLE "customer_ledger_entries" ADD CONSTRAINT "customer_ledger_amount_ck" CHECK (
  ("type" IN ('CREDIT_SALE', 'MANUAL_CREDIT') AND "amount" > 0)
  OR ("type" IN ('PAYMENT', 'REFUND_CREDIT') AND "amount" < 0)
  OR ("type" = 'OPENING_BALANCE' AND "amount" <> 0)
);
ALTER TABLE "customer_ledger_entries" ADD CONSTRAINT "customer_ledger_method_ck" CHECK (
  ("type" = 'PAYMENT') = ("payment_method" IS NOT NULL) AND "payment_method" IS DISTINCT FROM 'UDHAAR'
);
ALTER TABLE "customer_ledger_entries" ADD CONSTRAINT "customer_ledger_sale_ck" CHECK ("type" <> 'CREDIT_SALE' OR "order_id" IS NOT NULL);
ALTER TABLE "customer_ledger_entries" ADD CONSTRAINT "customer_ledger_refund_ck" CHECK ("type" <> 'REFUND_CREDIT' OR "refund_id" IS NOT NULL);
ALTER TABLE "customer_ledger_entries" ADD CONSTRAINT "customer_ledger_idempotency_ck" CHECK (("idempotency_key" IS NULL) = ("request_hash" IS NULL));
CREATE UNIQUE INDEX "customer_ledger_credit_sale_uq" ON "customer_ledger_entries"("order_id") WHERE "type" = 'CREDIT_SALE';
CREATE UNIQUE INDEX "customer_ledger_refund_credit_uq" ON "customer_ledger_entries"("refund_id") WHERE "type" = 'REFUND_CREDIT';
CREATE UNIQUE INDEX "customer_ledger_legacy_id_uq" ON "customer_ledger_entries"("legacy_id") WHERE "legacy_id" IS NOT NULL;

-- Vendor ledger: + raises what the shop owes (purchase, D-20), − is a payment.
ALTER TABLE "vendor_ledger_entries" ADD CONSTRAINT "vendor_ledger_amount_ck" CHECK (
  ("type" = 'PURCHASE' AND "amount" > 0)
  OR ("type" = 'PAYMENT' AND "amount" < 0)
  OR ("type" = 'OPENING_BALANCE' AND "amount" <> 0)
);
ALTER TABLE "vendor_ledger_entries" ADD CONSTRAINT "vendor_ledger_method_ck" CHECK (
  ("type" = 'PAYMENT') = ("payment_method" IS NOT NULL) AND "payment_method" IS DISTINCT FROM 'UDHAAR'
);
ALTER TABLE "vendor_ledger_entries" ADD CONSTRAINT "vendor_ledger_idempotency_ck" CHECK (("idempotency_key" IS NULL) = ("request_hash" IS NULL));
CREATE UNIQUE INDEX "vendor_ledger_legacy_id_uq" ON "vendor_ledger_entries"("legacy_id") WHERE "legacy_id" IS NOT NULL;
