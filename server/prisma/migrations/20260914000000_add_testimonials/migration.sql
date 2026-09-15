CREATE TABLE "testimonials" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "designation" VARCHAR(120) NOT NULL,
    "main_testimony" VARCHAR(150) NOT NULL,
    "sub_testimony" VARCHAR(100) NOT NULL,
    "media_content" TEXT NOT NULL,
    "media_type" VARCHAR(10) NOT NULL,
    "media_file_name" VARCHAR(255) NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "testimonials_position_key" ON "testimonials"("position");
CREATE INDEX "testimonials_position_idx" ON "testimonials"("position");
