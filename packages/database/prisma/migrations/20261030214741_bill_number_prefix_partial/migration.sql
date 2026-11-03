-- Prefix search on bill numbers (`ORD-20261028%`). Partial with an always-true predicate on purpose:
-- Prisma cannot represent `varchar_pattern_ops` and reports a full index as drift; partial indexes it
-- leaves alone, and `bill_number LIKE 'x%'` implies `bill_number IS NOT NULL`, so the planner uses it.
CREATE INDEX "orders_bill_number_prefix_idx" ON "orders"("bill_number" varchar_pattern_ops) WHERE "bill_number" IS NOT NULL;
