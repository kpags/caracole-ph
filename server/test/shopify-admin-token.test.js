import test from 'node:test'
import assert from 'node:assert/strict'
import { createShopifyAdminTokenProvider } from '../src/lib/shopify-admin-token.js'

const config = { SHOPIFY_STORE_DOMAIN: 'dexterton-2.myshopify.com', SHOPIFY_CLIENT_ID: 'client-id', SHOPIFY_CLIENT_SECRET: 'client-secret' }

test('exchanges Dev Dashboard credentials once and reuses the token until refresh time', async () => {
  let now = 0
  let calls = 0
  const provider = createShopifyAdminTokenProvider(config, async (_url, options) => {
    calls += 1
    assert.equal(options.method, 'POST')
    assert.match(String(options.body), /grant_type=client_credentials/)
    return new Response(JSON.stringify({ access_token: `token-${calls}`, scope: 'read_products', expires_in: 86400 }), { status: 200 })
  }, () => now)

  assert.equal(await provider.getAccessToken(), 'token-1')
  assert.equal(await provider.getAccessToken(), 'token-1')
  now = 86101 * 1000
  assert.equal(await provider.getAccessToken(), 'token-2')
  assert.equal(calls, 2)
})

test('rejects a token without read_products', async () => {
  const provider = createShopifyAdminTokenProvider(config, async () => new Response(JSON.stringify({ access_token: 'token', scope: 'read_orders', expires_in: 86400 }), { status: 200 }))
  await assert.rejects(provider.getAccessToken(), /read_products/)
})

test('accepts write_products because it includes product read access', async () => {
  const provider = createShopifyAdminTokenProvider(config, async () => new Response(JSON.stringify({ access_token: 'token', scope: 'write_products', expires_in: 86400 }), { status: 200 }))
  assert.equal(await provider.getAccessToken(), 'token')
})

test('returns a clear credential exchange failure', async () => {
  const provider = createShopifyAdminTokenProvider(config, async () => new Response(JSON.stringify({ error: 'invalid_client' }), { status: 401 }))
  await assert.rejects(provider.getAccessToken(), /invalid_client/)
})
