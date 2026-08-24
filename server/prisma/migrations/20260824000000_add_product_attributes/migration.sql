CREATE TABLE "attributes" (
  "id" UUID NOT NULL,
  "key" VARCHAR(80) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "attributes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_attribute_values" (
  "id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "attribute_id" UUID NOT NULL,
  "value" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "product_attribute_values_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attributes_key_key" ON "attributes"("key");
CREATE UNIQUE INDEX "attributes_name_key" ON "attributes"("name");
CREATE UNIQUE INDEX "product_attribute_values_product_id_attribute_id_key" ON "product_attribute_values"("product_id", "attribute_id");
CREATE INDEX "product_attribute_values_attribute_id_idx" ON "product_attribute_values"("attribute_id");

ALTER TABLE "product_attribute_values"
ADD CONSTRAINT "product_attribute_values_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_attribute_values"
ADD CONSTRAINT "product_attribute_values_attribute_id_fkey"
FOREIGN KEY ("attribute_id") REFERENCES "attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
