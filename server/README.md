# Caracole PH API

1. Copy the root `.env.example` to `.env` and replace all placeholder secrets and SMTP values.
2. Run `docker compose up --build` for the first start, or `docker compose up` later.
3. Confirm the service at `http://localhost:3000/health` (or your `API_PORT`).

Keep `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `DATABASE_URL` consistent. PostgreSQL reads these values only when its named volume is first initialized; if you intentionally change them later, remove the project database volume before restarting. Quote any `.env` value containing `$` with single quotes so Docker Compose treats it literally.

The `migrate` Compose service waits for PostgreSQL, applies Prisma migrations, then runs `db:seed-system-admin` on every `docker compose up`. When `SEED_SUPERUSER_EMAIL` and `SEED_SUPERUSER_PASSWORD` are configured, it creates the default system administrator only if that email does not already exist; existing accounts are preserved. The API is not started if migrations or the seed step fails.

Unlayer HTML exports belong in `src/templates/email/signup-otp/template.html` and `src/templates/email/forgot-password-otp/template.html`. Keep the `{{otp}}`, `{{firstName}}`, and `{{appName}}` Handlebars variables in the exported HTML.

Designer registration is `POST /api/v1/auth/register/designer`. It accepts `email`, `password`, and a `designer` object containing `firstName`, `lastName`, `mobileNumber`, `birthdate`, `touchpoint`, and `howDidYouHearAboutUs`; `company`, `officeAddress`, and `companyWebsite` are optional.
