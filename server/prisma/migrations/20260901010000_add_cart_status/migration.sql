CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'ABANDONED');

ALTER TABLE "carts"
  ADD COLUMN "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE';

UPDATE "carts"
  SET "status" = 'ABANDONED'
  WHERE "item_count" > 0
    AND "updated_at" <= CURRENT_TIMESTAMP - INTERVAL '7 days';

CREATE INDEX "carts_status_updated_at_idx" ON "carts"("status", "updated_at");
