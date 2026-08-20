CREATE TABLE "shop_the_look_environments" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "image_url" TEXT NOT NULL,
  "image_file_name" VARCHAR(255) NOT NULL,
  "position" INTEGER NOT NULL,
  "hotspots" JSONB NOT NULL DEFAULT '[]',

  CONSTRAINT "shop_the_look_environments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shop_the_look_environments_position_key" ON "shop_the_look_environments"("position");
CREATE INDEX "shop_the_look_environments_position_idx" ON "shop_the_look_environments"("position");
