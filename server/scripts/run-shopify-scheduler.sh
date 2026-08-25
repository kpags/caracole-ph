#!/bin/sh
set -eu
echo "Running initial rejected-designer cleanup..."
npm run db:purge-rejected-designers
echo "Running initial Shopify catalog sync..."
npm run shopify:sync-products
printf '%s\n' \
  "10 0 * * * cd /app && node scripts/delete-rejected-designers.js >> /proc/1/fd/1 2>&1" \
  "0 2,14 * * * cd /app && node scripts/sync-shopify-products.js >> /proc/1/fd/1 2>&1" | crontab -
exec crond -f -l 2
