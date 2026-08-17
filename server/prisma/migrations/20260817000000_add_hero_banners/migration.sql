CREATE TABLE "hero_banners" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "title" VARCHAR(80) NOT NULL,
  "subtitle" VARCHAR(120),
  "description" VARCHAR(200) NOT NULL,
  "category" VARCHAR(80) NOT NULL,
  "media_url" TEXT NOT NULL,
  "media_type" VARCHAR(10) NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "hero_banners_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hero_banners_position_key" ON "hero_banners"("position");
CREATE INDEX "hero_banners_position_idx" ON "hero_banners"("position");
