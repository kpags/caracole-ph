ALTER TABLE "inquiries" ADD COLUMN "article_number" VARCHAR(120);

CREATE INDEX "inquiries_product_name_created_at_idx" ON "inquiries"("product_name", "created_at");
CREATE INDEX "inquiries_edp_number_created_at_idx" ON "inquiries"("edp_number", "created_at");
CREATE INDEX "inquiries_article_number_created_at_idx" ON "inquiries"("article_number", "created_at");
