CREATE TABLE "showroom_branches" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "slug" VARCHAR(180) NOT NULL,
  "address" VARCHAR(500) NOT NULL,
  "contact_numbers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "position" INTEGER NOT NULL,
  CONSTRAINT "showroom_branches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "showroom_images" (
  "id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "image_url" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "showroom_images_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "showroom_schedules" (
  "id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "day_start" INTEGER NOT NULL,
  "day_end" INTEGER NOT NULL,
  "time_open" VARCHAR(5) NOT NULL,
  "time_close" VARCHAR(5) NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "showroom_schedules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "showroom_branches_name_key" ON "showroom_branches"("name");
CREATE UNIQUE INDEX "showroom_branches_slug_key" ON "showroom_branches"("slug");
CREATE UNIQUE INDEX "showroom_branches_position_key" ON "showroom_branches"("position");
CREATE INDEX "showroom_branches_position_idx" ON "showroom_branches"("position");
CREATE UNIQUE INDEX "showroom_images_branch_id_position_key" ON "showroom_images"("branch_id", "position");
CREATE UNIQUE INDEX "showroom_schedules_branch_id_position_key" ON "showroom_schedules"("branch_id", "position");

ALTER TABLE "showroom_images" ADD CONSTRAINT "showroom_images_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "showroom_branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "showroom_schedules" ADD CONSTRAINT "showroom_schedules_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "showroom_branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
