CREATE TYPE "CartOwnerType" AS ENUM ('REGISTERED', 'SESSION');

CREATE TABLE "carts" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "owner_key" VARCHAR(360) NOT NULL,
  "owner_type" "CartOwnerType" NOT NULL,
  "session_id" VARCHAR(180) NOT NULL,
  "customer_email" VARCHAR(320),
  "customer_first_name" VARCHAR(100),
  "customer_last_name" VARCHAR(100),
  "items" JSONB NOT NULL DEFAULT '[]',
  "item_count" INTEGER NOT NULL DEFAULT 0,
  "total_price" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "currency_code" VARCHAR(3) NOT NULL DEFAULT 'PHP',
  CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "carts_owner_key_key" ON "carts"("owner_key");
CREATE INDEX "carts_owner_type_item_count_created_at_idx" ON "carts"("owner_type", "item_count", "created_at");
CREATE INDEX "carts_owner_type_item_count_updated_at_idx" ON "carts"("owner_type", "item_count", "updated_at");
CREATE INDEX "carts_customer_email_idx" ON "carts"("customer_email");
