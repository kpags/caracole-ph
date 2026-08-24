CREATE TYPE "DesignerReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "designers"
  ADD COLUMN "review_status" "DesignerReviewStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "reviewed_at" TIMESTAMPTZ(6),
  ADD COLUMN "reviewed_by_id" UUID;

CREATE INDEX "designers_review_status_idx" ON "designers"("review_status");

ALTER TABLE "designers"
  ADD CONSTRAINT "designers_reviewed_by_id_fkey"
  FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
