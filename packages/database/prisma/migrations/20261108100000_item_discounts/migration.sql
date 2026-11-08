-- A discount on one item of a bill (D-27, F-39). `line_discount` still holds everything taken off the
-- line (its item discount plus its share of the bill discount), so the existing arithmetic CHECKs and
-- the refund maths are unchanged; these columns only record how much of it was the item's own.
ALTER TABLE "orders" ADD COLUMN "item_discount_total" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "order_lines" ADD COLUMN "item_discount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- A bill with no overall discount can now carry item discounts, and nothing else.
ALTER TABLE "orders" DROP CONSTRAINT "orders_discount_ck";
ALTER TABLE "orders" ADD CONSTRAINT "orders_discount_ck" CHECK (
  ("discount_type" <> 'NONE' OR ("discount_value" = 0 AND "discount_total" = "item_discount_total"))
  AND ("discount_type" <> 'PERCENT' OR "discount_value" <= 100)
);
ALTER TABLE "orders" ADD CONSTRAINT "orders_item_discount_ck" CHECK ("item_discount_total" BETWEEN 0 AND "discount_total");
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_item_discount_ck" CHECK ("item_discount" BETWEEN 0 AND "line_discount");
