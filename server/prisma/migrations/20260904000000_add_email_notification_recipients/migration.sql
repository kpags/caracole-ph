CREATE TYPE "EmailNotificationEvent" AS ENUM ('GENERAL_INQUIRY', 'PRODUCT_INQUIRY', 'DESIGNER_REGISTRATION');

CREATE TABLE "email_notification_recipients" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "event" "EmailNotificationEvent" NOT NULL,
    "to_recipients" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "cc_recipients" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "bcc_recipients" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "email_notification_recipients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_notification_recipients_event_key" ON "email_notification_recipients"("event");
