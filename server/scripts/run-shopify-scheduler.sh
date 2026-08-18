#!/bin/sh
set -eu
echo "Running initial Shopify catalog sync..."
npm run shopify:sync-products
echo "0 2,14 * * * cd /app && node scripts/sync-shopify-products.js >> /proc/1/fd/1 2>&1" | crontab -
exec crond -f -l 2
