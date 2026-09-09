ALTER TABLE "payment_gateways" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT false;

-- Before this field existed, the enabled PayMongo gateway was implicitly used
-- for checkout. Preserve that behavior during deployment.
UPDATE "payment_gateways"
SET "is_active" = true
WHERE "provider" = 'PAYMONGO'
  AND "is_enabled" = true
  AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX "payment_gateways_one_active_gateway_key"
  ON "payment_gateways" (("is_active"))
  WHERE "is_active" = true AND "deleted_at" IS NULL;
