CREATE TYPE "CustomerSource" AS ENUM ('WEBSITE', 'SHOPIFY');

CREATE TABLE "customers" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "user_id" UUID NOT NULL,
  "shopify_id" TEXT,
  "source" "CustomerSource" NOT NULL DEFAULT 'SHOPIFY',
  "phone" VARCHAR(60),
  "shopify_state" VARCHAR(40),
  "shopify_verified_email" BOOLEAN,
  "order_count" INTEGER NOT NULL DEFAULT 0,
  "amount_spent" DECIMAL(14,2),
  "currency_code" VARCHAR(3),
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "default_address" JSONB,
  "shopify_created_at" TIMESTAMPTZ(6),
  "shopify_updated_at" TIMESTAMPTZ(6),
  "last_synced_at" TIMESTAMPTZ(6),
  "legacy_invitation_sent_at" TIMESTAMPTZ(6),
  CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customers_user_id_key" ON "customers"("user_id");
CREATE UNIQUE INDEX "customers_shopify_id_key" ON "customers"("shopify_id");
CREATE INDEX "customers_source_idx" ON "customers"("source");
CREATE INDEX "customers_last_synced_at_idx" ON "customers"("last_synced_at");

ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
