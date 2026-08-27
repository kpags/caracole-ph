import 'dotenv/config'
import { z } from 'zod'

const booleanFromEnv = z.enum(['true', 'false']).default('false').transform((value) => value === 'true')

export const config = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  APP_NAME: z.string().min(1).default('Caracole PH'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: booleanFromEnv,
  SMTP_USER: z.string().min(1),
  SMTP_PASSWORD: z.string().min(1),
  EMAIL_FROM: z.string().min(3),
  ADMIN_DASHBOARD_URL: z.string().url().default('http://localhost:5173/admin'),
  ADMIN_INVITATION_SETUP_URL: z.string().url().default('http://localhost:8080/admin/setup-password'),
  ADMIN_INVITATION_EXPIRES_IN: z.string().min(1).default('7d'),
  CLOUDFLARE_R2_ACCOUNT_ID: z.string().min(1),
  CLOUDFLARE_R2_BUCKET_NAME: z.string().min(1),
  CLOUDFLARE_R2_ACCESS_KEY_ID: z.string().min(1),
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: z.string().min(1),
  CLOUDFLARE_R2_PUBLIC_BASE_URL: z.string().url(),
  SHOPIFY_STORE_DOMAIN: z.string().min(1),
  SHOPIFY_STOREFRONT_API_VERSION: z.string().regex(/^\d{4}-\d{2}$/).default('2026-07'),
  SHOPIFY_PRIVATE_ACCESS_TOKEN: z.string().min(1),
  SHOPIFY_CLIENT_ID: z.string().min(1),
  SHOPIFY_CLIENT_SECRET: z.string().min(1),
  SHOPIFY_VENDOR: z.string().min(1).default('Caracole'),
  SHOPIFY_PRODUCT_CATEGORY_METAFIELD_NAMESPACE: z.string().min(1).default('custom'),
  SHOPIFY_PRODUCT_CATEGORY_METAFIELD_KEY: z.string().min(1).default('categories'),
  SEED_SUPERUSER_EMAIL: z.string().email().optional().or(z.literal('')),
  SEED_SUPERUSER_PASSWORD: z.string().min(8).optional().or(z.literal(''))
}).parse(process.env)
