CREATE INDEX "users_pending_customer_cleanup_idx"
  ON "users"("is_active", "is_email_verified", "is_designer", "is_staff", "is_superuser", "created_at");
