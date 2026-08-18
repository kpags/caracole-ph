CREATE TABLE "products" (
  "id" UUID NOT NULL,
  "shopify_id" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "vendor" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "description_html" TEXT NOT NULL DEFAULT '',
  "product_type" TEXT NOT NULL DEFAULT '',
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" TEXT NOT NULL,
  "seo_title" TEXT,
  "seo_description" TEXT,
  "main_category" TEXT,
  "subcategory" TEXT,
  "sku" TEXT,
  "price" DECIMAL(14,2),
  "currency_code" VARCHAR(3),
  "available_for_sale" BOOLEAN NOT NULL DEFAULT false,
  "total_inventory" INTEGER,
  "featured_image_url" TEXT,
  "featured_image_alt" TEXT,
  "images" JSONB NOT NULL DEFAULT '[]',
  "options" JSONB NOT NULL DEFAULT '[]',
  "variants" JSONB NOT NULL DEFAULT '[]',
  "media" JSONB NOT NULL DEFAULT '[]',
  "metafields" JSONB NOT NULL DEFAULT '{}',
  "shopify_data" JSONB NOT NULL,
  "shopify_created_at" TIMESTAMPTZ(6),
  "shopify_updated_at" TIMESTAMPTZ(6),
  "published_at" TIMESTAMPTZ(6),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "last_synced_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "products_shopify_id_key" ON "products"("shopify_id");
CREATE UNIQUE INDEX "products_handle_key" ON "products"("handle");
CREATE INDEX "products_is_active_main_category_idx" ON "products"("is_active", "main_category");
CREATE INDEX "products_is_active_subcategory_idx" ON "products"("is_active", "subcategory");
CREATE INDEX "products_is_active_published_at_idx" ON "products"("is_active", "published_at");

CREATE TABLE "catalog_sync_runs" (
  "id" UUID NOT NULL,
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMPTZ(6),
  "status" TEXT NOT NULL,
  "fetched_count" INTEGER NOT NULL DEFAULT 0,
  "created_count" INTEGER NOT NULL DEFAULT 0,
  "updated_count" INTEGER NOT NULL DEFAULT 0,
  "deactivated_count" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  CONSTRAINT "catalog_sync_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "catalog_sync_runs_started_at_idx" ON "catalog_sync_runs"("started_at");
