ALTER TABLE "users" DROP COLUMN "is_google_account";
DROP TABLE "user_profiles";

CREATE TABLE "designers" (
  "id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "user_id" UUID NOT NULL,
  "first_name" TEXT NOT NULL,
  "last_name" TEXT NOT NULL,
  "birthdate" DATE NOT NULL,
  "mobile_number" VARCHAR(13) NOT NULL,
  "company" TEXT,
  "office_address" TEXT,
  "company_website" TEXT,
  "touchpoint" TEXT NOT NULL,
  "how_did_you_hear_about_us" TEXT NOT NULL,
  CONSTRAINT "designers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "designers_user_id_key" ON "designers"("user_id");
ALTER TABLE "designers" ADD CONSTRAINT "designers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
