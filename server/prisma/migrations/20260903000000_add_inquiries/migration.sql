CREATE TYPE "InquiryStatus" AS ENUM ('PENDING', 'ENDORSED', 'SPAM');

CREATE TABLE "inquiries" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "first_name" VARCHAR(100) NOT NULL,
  "last_name" VARCHAR(100) NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "contact_number" VARCHAR(60) NOT NULL,
  "message" TEXT NOT NULL,
  "product_name" VARCHAR(255),
  "edp_number" VARCHAR(120),
  "status" "InquiryStatus" NOT NULL DEFAULT 'PENDING',

  CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inquiries_status_created_at_idx" ON "inquiries"("status", "created_at");
CREATE INDEX "inquiries_email_idx" ON "inquiries"("email");
