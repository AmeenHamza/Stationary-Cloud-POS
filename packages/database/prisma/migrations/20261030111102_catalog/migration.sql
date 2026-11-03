-- CreateEnum
CREATE TYPE "sale_unit" AS ENUM ('PIECE', 'BOX');

-- CreateEnum
CREATE TYPE "stock_movement_type" AS ENUM ('OPENING', 'SALE', 'REFUND', 'RESTOCK', 'ADJUSTMENT_INCREASE', 'ADJUSTMENT_DECREASE', 'MIGRATION');

-- CreateEnum
CREATE TYPE "adjustment_reason" AS ENUM ('DAMAGED', 'LOST', 'COUNT_CORRECTION', 'OTHER');

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" CITEXT NOT NULL,
    "icon_emoji" VARCHAR(16),
    "description" VARCHAR(200),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "legacy_id" VARCHAR(64),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "barcode" VARCHAR(64),
    "name" VARCHAR(200) NOT NULL,
    "name_key" VARCHAR(200) NOT NULL,
    "name_urdu" VARCHAR(200),
    "category_id" UUID,
    "base_unit_label" VARCHAR(20) NOT NULL DEFAULT 'Piece',
    "pieces_per_box" INTEGER NOT NULL DEFAULT 1,
    "sale_price" DECIMAL(12,2) NOT NULL,
    "box_price" DECIMAL(12,2),
    "cost_price" DECIMAL(12,2),
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "low_stock_threshold_pieces" INTEGER NOT NULL DEFAULT 10,
    "low_stock_threshold_unit" "sale_unit" NOT NULL DEFAULT 'PIECE',
    "stock_pieces" INTEGER NOT NULL DEFAULT 0,
    "cloned_from_id" UUID,
    "idempotency_key" UUID,
    "request_hash" BYTEA,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "legacy_id" VARCHAR(64),
    "legacy_barcode" VARCHAR(128),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" BIGSERIAL NOT NULL,
    "product_id" UUID NOT NULL,
    "type" "stock_movement_type" NOT NULL,
    "quantity_pieces" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "reason" "adjustment_reason",
    "note" VARCHAR(200),
    "order_id" UUID,
    "refund_id" UUID,
    "import_job_id" UUID,
    "idempotency_key" UUID,
    "request_hash" BYTEA,
    "actor_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_uq" ON "categories"("name");

-- CreateIndex
CREATE INDEX "categories_name_id_idx" ON "categories"("name", "id");

-- CreateIndex
CREATE UNIQUE INDEX "products_idempotency_key_uq" ON "products"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "stock_movements_idempotency_key_uq" ON "stock_movements"("idempotency_key");

-- CreateIndex
CREATE INDEX "stock_movements_product_created_idx" ON "stock_movements"("product_id", "created_at" DESC, "id" DESC);

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_fk" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_cloned_from_fk" FOREIGN KEY ("cloned_from_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_actor_fk" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written constraints Prisma cannot express (DATABASE.md §4.4–4.6)
ALTER TABLE "categories" ADD CONSTRAINT "categories_name_ck" CHECK (char_length("name") BETWEEN 1 AND 80);
ALTER TABLE "categories" ADD CONSTRAINT "categories_version_ck" CHECK ("version" >= 1);
CREATE UNIQUE INDEX "categories_legacy_id_uq" ON "categories"("legacy_id") WHERE "legacy_id" IS NOT NULL;

ALTER TABLE "products" ADD CONSTRAINT "products_name_ck" CHECK (char_length("name") BETWEEN 1 AND 200 AND char_length("name_key") >= 1);
ALTER TABLE "products" ADD CONSTRAINT "products_pieces_per_box_ck" CHECK ("pieces_per_box" BETWEEN 1 AND 10000);
ALTER TABLE "products" ADD CONSTRAINT "products_prices_ck" CHECK ("sale_price" >= 0 AND ("box_price" IS NULL OR "box_price" >= 0) AND ("cost_price" IS NULL OR "cost_price" >= 0));
-- A box price only makes sense when a box holds more than one piece (D-17, A-08).
ALTER TABLE "products" ADD CONSTRAINT "products_box_price_ck" CHECK ("box_price" IS NULL OR "pieces_per_box" > 1);
ALTER TABLE "products" ADD CONSTRAINT "products_tax_rate_ck" CHECK ("tax_rate" BETWEEN 0 AND 100);
ALTER TABLE "products" ADD CONSTRAINT "products_threshold_ck" CHECK ("low_stock_threshold_pieces" >= 0);
ALTER TABLE "products" ADD CONSTRAINT "products_idempotency_ck" CHECK (("idempotency_key" IS NULL) = ("request_hash" IS NULL));
ALTER TABLE "products" ADD CONSTRAINT "products_version_ck" CHECK ("version" >= 1);
CREATE UNIQUE INDEX "products_legacy_id_uq" ON "products"("legacy_id") WHERE "legacy_id" IS NOT NULL;

-- Each index serves a query in DATABASE.md §5 (active products only).
CREATE UNIQUE INDEX "products_barcode_active_uq" ON "products"("barcode") WHERE "barcode" IS NOT NULL AND "archived_at" IS NULL;
CREATE INDEX "products_active_name_idx" ON "products"("name_key", "id") WHERE "archived_at" IS NULL;
CREATE INDEX "products_active_category_name_idx" ON "products"("category_id", "name_key", "id") WHERE "archived_at" IS NULL;
CREATE INDEX "products_active_price_idx" ON "products"("sale_price", "id") WHERE "archived_at" IS NULL;
-- BR-02 (stock ≤ threshold) appears only here and in @pos/domain/stock/low-stock.ts.
CREATE INDEX "products_low_stock_idx" ON "products"("stock_pieces", "id") WHERE "archived_at" IS NULL AND "stock_pieces" <= "low_stock_threshold_pieces";
CREATE INDEX "products_name_key_trgm_idx" ON "products" USING GIN ("name_key" gin_trgm_ops);
CREATE INDEX "products_name_urdu_trgm_idx" ON "products" USING GIN ("name_urdu" gin_trgm_ops);
CREATE INDEX "products_category_fk_idx" ON "products"("category_id");

-- Stock ledger: sign and required references per movement type (ADR-016, D-18).
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_quantity_ck" CHECK (
  ("type" IN ('SALE', 'ADJUSTMENT_DECREASE') AND "quantity_pieces" < 0)
  OR ("type" IN ('REFUND', 'RESTOCK', 'ADJUSTMENT_INCREASE', 'OPENING') AND "quantity_pieces" > 0)
  OR ("type" = 'MIGRATION' AND "quantity_pieces" <> 0)
);
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_reason_ck" CHECK (("type" IN ('ADJUSTMENT_INCREASE', 'ADJUSTMENT_DECREASE')) = ("reason" IS NOT NULL));
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_sale_ck" CHECK ("type" <> 'SALE' OR "order_id" IS NOT NULL);
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_refund_ck" CHECK ("type" <> 'REFUND' OR "refund_id" IS NOT NULL);
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_idempotency_ck" CHECK (("idempotency_key" IS NULL) = ("request_hash" IS NULL));
