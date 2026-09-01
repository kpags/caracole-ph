ALTER TABLE "product_attribute_values"
ADD COLUMN "numeric_value" DOUBLE PRECISION;

CREATE INDEX "product_attribute_values_attribute_id_numeric_value_idx"
ON "product_attribute_values"("attribute_id", "numeric_value");
