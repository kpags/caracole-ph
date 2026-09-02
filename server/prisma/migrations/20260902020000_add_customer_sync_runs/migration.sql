CREATE TYPE "CustomerSyncStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "customer_sync_runs" (
  "id" UUID NOT NULL,
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMPTZ(6),
  "status" "CustomerSyncStatus" NOT NULL DEFAULT 'RUNNING',
  "fetched_count" INTEGER NOT NULL DEFAULT 0,
  "created_count" INTEGER NOT NULL DEFAULT 0,
  "updated_count" INTEGER NOT NULL DEFAULT 0,
  "conflict_count" INTEGER NOT NULL DEFAULT 0,
  "removed_count" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  CONSTRAINT "customer_sync_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "customer_sync_runs_started_at_idx" ON "customer_sync_runs"("started_at");
