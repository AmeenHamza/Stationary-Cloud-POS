-- CreateEnum
CREATE TYPE "import_kind" AS ENUM ('PRODUCTS');

-- CreateEnum
CREATE TYPE "import_status" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "import_row_status" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" UUID NOT NULL,
    "kind" "import_kind" NOT NULL,
    "status" "import_status" NOT NULL DEFAULT 'QUEUED',
    "file_name" VARCHAR(200) NOT NULL,
    "total_rows" INTEGER NOT NULL,
    "processed_rows" INTEGER NOT NULL DEFAULT 0,
    "succeeded_rows" INTEGER NOT NULL DEFAULT 0,
    "failed_rows" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),
    "error_summary" VARCHAR(300),

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_job_rows" (
    "id" BIGSERIAL NOT NULL,
    "job_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "status" "import_row_status" NOT NULL DEFAULT 'PENDING',
    "error" VARCHAR(300),
    "product_id" UUID,

    CONSTRAINT "import_job_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_jobs_created_idx" ON "import_jobs"("created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "import_jobs_status_idx" ON "import_jobs"("status");

-- CreateIndex
CREATE INDEX "import_job_rows_job_status_idx" ON "import_job_rows"("job_id", "status", "row_number");

-- CreateIndex
CREATE UNIQUE INDEX "import_job_rows_job_row_uq" ON "import_job_rows"("job_id", "row_number");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_import_job_fk" FOREIGN KEY ("import_job_id") REFERENCES "import_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_created_by_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_job_rows" ADD CONSTRAINT "import_job_rows_job_fk" FOREIGN KEY ("job_id") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_job_rows" ADD CONSTRAINT "import_job_rows_product_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written constraints Prisma cannot express (DATABASE.md §4.15).
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_counts_ck" CHECK (
  "total_rows" BETWEEN 0 AND 5000 AND "processed_rows" BETWEEN 0 AND "total_rows"
  AND "succeeded_rows" >= 0 AND "failed_rows" >= 0
  AND "succeeded_rows" + "failed_rows" <= "processed_rows"
);
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_finished_ck" CHECK (
  ("status" IN ('COMPLETED', 'FAILED')) = ("finished_at" IS NOT NULL)
);
ALTER TABLE "import_job_rows" ADD CONSTRAINT "import_job_rows_row_ck" CHECK ("row_number" >= 1);
ALTER TABLE "import_job_rows" ADD CONSTRAINT "import_job_rows_error_ck" CHECK (
  ("status" = 'FAILED') = ("error" IS NOT NULL)
);
ALTER TABLE "import_job_rows" ADD CONSTRAINT "import_job_rows_product_ck" CHECK (
  "status" <> 'SUCCEEDED' OR "product_id" IS NOT NULL
);
