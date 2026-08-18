# Caracole PH API

1. Copy the root `.env.example` to `.env` and replace all placeholder secrets and SMTP values.
2. Run `docker compose up --build` for the first start, or `docker compose up` later.
3. Confirm the service at `http://localhost:3000/health` (or your `API_PORT`).

Keep `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `DATABASE_URL` consistent. PostgreSQL reads these values only when its named volume is first initialized; if you intentionally change them later, remove the project database volume before restarting. Quote any `.env` value containing `$` with single quotes so Docker Compose treats it literally.

The `migrate` Compose service waits for PostgreSQL, applies Prisma migrations, then runs `db:seed-system-admin` on every `docker compose up`. When `SEED_SUPERUSER_EMAIL` and `SEED_SUPERUSER_PASSWORD` are configured, it creates the default system administrator only if that email does not already exist; existing accounts are preserved. The API is not started if migrations or the seed step fails.

## Shopify catalog sync

Set `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` from the installed Dev Dashboard app. The scheduler exchanges them for short-lived Admin API tokens and requires the app's `read_products` scope. The `catalog-scheduler` service syncs the full Caracole product mirror at 2:00 AM and 2:00 PM Asia/Manila. Run `npm run shopify:sync-products` from `server/` to trigger the same sync manually. Public catalog requests read the local database and support `page`, `limit`, `category`, `subcategory`, `search`, `inStock`, `minPrice`, `maxPrice`, and `sort`.

Unlayer HTML exports belong in `src/templates/email/signup-otp/template.html` and `src/templates/email/forgot-password-otp/template.html`. Keep the `{{otp}}`, `{{firstName}}`, and `{{appName}}` Handlebars variables in the exported HTML.

Designer registration is `POST /api/v1/auth/register/designer`. It accepts `email`, `password`, and a `designer` object containing `firstName`, `lastName`, `mobileNumber`, `birthdate`, `touchpoint`, and `howDidYouHearAboutUs`; `company`, `officeAddress`, and `companyWebsite` are optional.

## Cloudflare R2 media storage

`src/lib/cloudflare-r2-storage.js` is a server-only utility for website images, videos, and files. It uploads an object and returns the public URL to save in the database, deletes an object by storage key or returned URL, and renames an object by copying it before deleting the source.

Create a Cloudflare R2 API token restricted to the configured bucket with **Object Read & Write** permissions. Configure `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_BUCKET_NAME`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, and `CLOUDFLARE_R2_PUBLIC_BASE_URL`. The public base URL must be the custom domain attached to the bucket (for example, `https://media.example.com`); never expose the R2 credentials to the browser.

Use `createCloudflareR2StorageFromConfig(config)` with the existing server configuration, then call `upload({ body, fileName, contentType, prefix })`, `delete(keyOrPublicUrl)`, or `rename(keyOrPublicUrl, newFileNameOrKey)`. Upload and rename return the public URL that should be stored in the database.
