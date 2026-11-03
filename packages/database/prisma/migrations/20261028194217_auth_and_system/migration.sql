-- Extensions used by later tables (citext usernames/names, trigram search) — DATABASE.md §1.9
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('ADMIN', 'CASHIER');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" CITEXT NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "user_role" NOT NULL,
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "password_changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idle_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "absolute_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "revoke_reason" VARCHAR(32),
    "ip" INET,
    "user_agent" VARCHAR(200),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_settings" (
    "id" SMALLINT NOT NULL DEFAULT 1,
    "shop_name" VARCHAR(120) NOT NULL,
    "address" VARCHAR(300),
    "phone" VARCHAR(30),
    "receipt_footer" VARCHAR(300),
    "default_bill_gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 18.00,
    "groq_api_key_ciphertext" BYTEA,
    "groq_api_key_last4" VARCHAR(4),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "shop_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "seq" BIGSERIAL NOT NULL,
    "type" VARCHAR(48) NOT NULL,
    "audience" VARCHAR(64) NOT NULL,
    "schema_version" SMALLINT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(3),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("seq")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "actor_user_id" UUID,
    "action" VARCHAR(64) NOT NULL,
    "entity_type" VARCHAR(32),
    "entity_id" VARCHAR(64),
    "metadata" JSONB,
    "ip" INET,
    "request_id" VARCHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_uq" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_uq" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "outbox_created_idx" ON "outbox_events"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_created_idx" ON "audit_logs"("created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs"("entity_type", "entity_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs"("actor_user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_settings" ADD CONSTRAINT "shop_settings_updated_by_fk" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_fk" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written constraints Prisma cannot express (DATABASE.md §4.1–4.3, §4.13)
ALTER TABLE "users" ADD CONSTRAINT "users_username_ck" CHECK ("username"::text ~ '^[a-z0-9._-]{3,40}$');
ALTER TABLE "users" ADD CONSTRAINT "users_version_ck" CHECK ("version" >= 1);
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_revoke_ck" CHECK (("revoked_at" IS NULL) = ("revoke_reason" IS NULL));
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_expiry_ck" CHECK ("idle_expires_at" <= "absolute_expires_at");
ALTER TABLE "shop_settings" ADD CONSTRAINT "shop_settings_singleton_ck" CHECK ("id" = 1);
ALTER TABLE "shop_settings" ADD CONSTRAINT "shop_settings_gst_ck" CHECK ("default_bill_gst_rate" BETWEEN 0 AND 100);
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_audience_ck" CHECK ("audience" ~ '^(staff|admin|user:[0-9a-f-]{36})$');

-- Partial index: the drain query reads only unpublished rows (SYSTEM_DESIGN.md §5.2)
CREATE INDEX "outbox_unpublished_idx" ON "outbox_events"("seq") WHERE "published_at" IS NULL;

-- The single settings row (Q26 default profile; the admin edits it in Settings)
INSERT INTO "shop_settings" ("id", "shop_name", "updated_at") VALUES (1, 'Stationery Shop', CURRENT_TIMESTAMP);
