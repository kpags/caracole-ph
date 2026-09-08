CREATE TYPE "PaymentGatewayProvider" AS ENUM ('PAYMONGO', 'STRIPE');
CREATE TYPE "PaymentGatewayMode" AS ENUM ('TEST', 'LIVE');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

CREATE TABLE "payment_gateways" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),
  "provider" "PaymentGatewayProvider" NOT NULL,
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "use_test_mode" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "payment_gateways_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payment_gateways_provider_key" ON "payment_gateways"("provider");
CREATE INDEX "payment_gateways_deleted_at_updated_at_idx" ON "payment_gateways"("deleted_at", "updated_at");

CREATE TABLE "payment_gateway_credentials" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "gateway_id" UUID NOT NULL,
  "mode" "PaymentGatewayMode" NOT NULL,
  "base_url" VARCHAR(255) NOT NULL DEFAULT 'https://api.paymongo.com',
  "public_key" TEXT NOT NULL,
  "secret_key_ciphertext" TEXT NOT NULL,
  "secret_key_fingerprint" VARCHAR(128) NOT NULL,
  "send_email_receipt" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "payment_gateway_credentials_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payment_gateway_credentials_gateway_id_mode_key" ON "payment_gateway_credentials"("gateway_id", "mode");
CREATE INDEX "payment_gateway_credentials_mode_idx" ON "payment_gateway_credentials"("mode");

CREATE TABLE "payment_gateway_webhooks" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "gateway_id" UUID NOT NULL,
  "credential_id" UUID NOT NULL,
  "provider_webhook_id" VARCHAR(120) NOT NULL,
  "event_type" VARCHAR(120) NOT NULL,
  "url" TEXT NOT NULL,
  "status" VARCHAR(40) NOT NULL DEFAULT 'enabled',
  "signing_secret_ciphertext" TEXT NOT NULL,
  "signing_secret_fingerprint" VARCHAR(128) NOT NULL,
  CONSTRAINT "payment_gateway_webhooks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payment_gateway_webhooks_provider_webhook_id_key" ON "payment_gateway_webhooks"("provider_webhook_id");
CREATE INDEX "payment_gateway_webhooks_gateway_id_created_at_idx" ON "payment_gateway_webhooks"("gateway_id", "created_at");
CREATE INDEX "payment_gateway_webhooks_credential_id_created_at_idx" ON "payment_gateway_webhooks"("credential_id", "created_at");

CREATE TABLE "orders" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "order_number" VARCHAR(80) NOT NULL,
  "access_token_hash" VARCHAR(128) NOT NULL,
  "customer" JSONB NOT NULL,
  "delivery" JSONB NOT NULL,
  "items" JSONB NOT NULL,
  "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "shipping_fee" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "currency_code" VARCHAR(3) NOT NULL DEFAULT 'PHP',
  "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");
CREATE UNIQUE INDEX "orders_access_token_hash_key" ON "orders"("access_token_hash");
CREATE INDEX "orders_payment_status_created_at_idx" ON "orders"("payment_status", "created_at");
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");

CREATE TABLE "payments" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "order_id" UUID NOT NULL,
  "gateway_id" UUID NOT NULL,
  "credential_id" UUID NOT NULL,
  "provider" "PaymentGatewayProvider" NOT NULL,
  "mode" "PaymentGatewayMode" NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "amount" DECIMAL(14,2) NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL DEFAULT 'PHP',
  "provider_checkout_session_id" VARCHAR(160),
  "checkout_url" TEXT,
  "provider_payment_intent_id" VARCHAR(160),
  "provider_payment_id" VARCHAR(160),
  "payment_method" VARCHAR(80),
  "fee" DECIMAL(14,2),
  "net_amount" DECIMAL(14,2),
  "provider_payload" JSONB,
  "paid_at" TIMESTAMPTZ(6),
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payments_provider_checkout_session_id_key" ON "payments"("provider_checkout_session_id");
CREATE UNIQUE INDEX "payments_provider_payment_id_key" ON "payments"("provider_payment_id");
CREATE INDEX "payments_order_id_created_at_idx" ON "payments"("order_id", "created_at");
CREATE INDEX "payments_status_created_at_idx" ON "payments"("status", "created_at");

CREATE TABLE "payment_attempts" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "payment_id" UUID NOT NULL,
  "provider_payment_intent_id" VARCHAR(160),
  "provider_payment_id" VARCHAR(160),
  "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'PENDING',
  "payment_method" VARCHAR(80),
  "amount" DECIMAL(14,2),
  "fee" DECIMAL(14,2),
  "net_amount" DECIMAL(14,2),
  "provider_payload" JSONB,
  CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payment_attempts_provider_payment_intent_id_key" ON "payment_attempts"("provider_payment_intent_id");
CREATE UNIQUE INDEX "payment_attempts_provider_payment_id_key" ON "payment_attempts"("provider_payment_id");
CREATE INDEX "payment_attempts_payment_id_created_at_idx" ON "payment_attempts"("payment_id", "created_at");

CREATE TABLE "payment_webhook_logs" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "webhook_id" UUID,
  "payment_id" UUID,
  "provider_event_id" VARCHAR(160),
  "event_type" VARCHAR(120),
  "payload" JSONB,
  "signature_verified" BOOLEAN NOT NULL DEFAULT false,
  "processed_at" TIMESTAMPTZ(6),
  "processing_error" TEXT,
  CONSTRAINT "payment_webhook_logs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payment_webhook_logs_webhook_id_provider_event_id_key" ON "payment_webhook_logs"("webhook_id", "provider_event_id");
CREATE INDEX "payment_webhook_logs_webhook_id_created_at_idx" ON "payment_webhook_logs"("webhook_id", "created_at");
CREATE INDEX "payment_webhook_logs_payment_id_created_at_idx" ON "payment_webhook_logs"("payment_id", "created_at");
CREATE INDEX "payment_webhook_logs_created_at_idx" ON "payment_webhook_logs"("created_at");

ALTER TABLE "payment_gateway_credentials" ADD CONSTRAINT "payment_gateway_credentials_gateway_id_fkey" FOREIGN KEY ("gateway_id") REFERENCES "payment_gateways"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_gateway_webhooks" ADD CONSTRAINT "payment_gateway_webhooks_gateway_id_fkey" FOREIGN KEY ("gateway_id") REFERENCES "payment_gateways"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_gateway_webhooks" ADD CONSTRAINT "payment_gateway_webhooks_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "payment_gateway_credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_gateway_id_fkey" FOREIGN KEY ("gateway_id") REFERENCES "payment_gateways"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "payment_gateway_credentials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_webhook_logs" ADD CONSTRAINT "payment_webhook_logs_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "payment_gateway_webhooks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_webhook_logs" ADD CONSTRAINT "payment_webhook_logs_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
