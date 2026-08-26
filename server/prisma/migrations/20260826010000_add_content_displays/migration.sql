CREATE TABLE "main_category_displays" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "image_url" TEXT NOT NULL,

  CONSTRAINT "main_category_displays_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "main_category_displays_name_key" ON "main_category_displays"("name");

CREATE TABLE "designer_profiles" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "slug" VARCHAR(180) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "tagline" VARCHAR(100) NOT NULL,
  "brief_story" VARCHAR(300) NOT NULL,
  "thumbnail_image_url" TEXT NOT NULL,
  "header_image_url" TEXT NOT NULL,
  "is_featured" BOOLEAN NOT NULL DEFAULT false,

  CONSTRAINT "designer_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "designer_profiles_slug_key" ON "designer_profiles"("slug");
CREATE INDEX "designer_profiles_is_featured_idx" ON "designer_profiles"("is_featured");

CREATE TABLE "designer_featured_products" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "designer_profile_id" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "short_description" VARCHAR(150) NOT NULL,
  "lifestyle_image_url" TEXT NOT NULL,
  "position" INTEGER NOT NULL,

  CONSTRAINT "designer_featured_products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "designer_featured_products_designer_profile_id_position_key"
  ON "designer_featured_products"("designer_profile_id", "position");
CREATE INDEX "designer_featured_products_designer_profile_id_idx"
  ON "designer_featured_products"("designer_profile_id");

ALTER TABLE "designer_featured_products"
  ADD CONSTRAINT "designer_featured_products_designer_profile_id_fkey"
  FOREIGN KEY ("designer_profile_id") REFERENCES "designer_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
