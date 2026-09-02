import assert from 'node:assert/strict'
import test from 'node:test'
import { createShopifyCustomerService, normalizeShopifyOrderCount } from '../src/lib/shopify-customers.js'

const config = {
  SHOPIFY_STORE_DOMAIN: 'example.myshopify.com',
  SHOPIFY_STOREFRONT_API_VERSION: '2026-07',
  SHOPIFY_PRIVATE_ACCESS_TOKEN: 'private-storefront-token'
}

test('uses the Shopify private Storefront token header for customer creation', async () => {
  const originalFetch = globalThis.fetch
  const requests = []
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options })
    return new Response(JSON.stringify({ data: { customerCreate: { customer: { id: 'gid://shopify/Customer/1', firstName: 'Ava', lastName: 'Reyes', email: 'ava@example.com', phone: null }, customerUserErrors: [] } } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  try {
    const customer = await createShopifyCustomerService(config).create({ firstName: 'Ava', lastName: 'Reyes', email: 'ava@example.com', password: 'eight-char-password' })
    assert.equal(customer.id, 'gid://shopify/Customer/1')
    assert.equal(requests[0].options.headers['Shopify-Storefront-Private-Token'], config.SHOPIFY_PRIVATE_ACCESS_TOKEN)
    assert.equal(requests[0].options.headers['X-Shopify-Storefront-Access-Token'], undefined)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('normalizes Shopify order counts before Prisma persistence', () => {
  assert.equal(normalizeShopifyOrderCount('0'), 0)
  assert.equal(normalizeShopifyOrderCount('12'), 12)
  assert.equal(normalizeShopifyOrderCount(3.9), 3)
  assert.equal(normalizeShopifyOrderCount(null), 0)
  assert.equal(normalizeShopifyOrderCount('unknown'), 0)
})
