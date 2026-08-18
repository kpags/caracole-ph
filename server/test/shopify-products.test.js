import test from 'node:test'
import assert from 'node:assert/strict'
import { createShopifyProductsService, normalizeShopifyProduct, parseProductCategory, ShopifyProductsError } from '../src/lib/shopify-products.js'

const config = {
  SHOPIFY_STORE_DOMAIN: 'dexterton-2.myshopify.com',
  SHOPIFY_STOREFRONT_API_VERSION: '2026-07',
  SHOPIFY_PRIVATE_ACCESS_TOKEN: 'test-token',
  SHOPIFY_VENDOR: 'Caracole',
  SHOPIFY_PRODUCT_CATEGORY_METAFIELD_NAMESPACE: 'custom',
  SHOPIFY_PRODUCT_CATEGORY_METAFIELD_KEY: 'categories',
}

const sourceProduct = {
  id: 'gid://shopify/Product/1', handle: 'luna-table', title: 'Luna Table', vendor: 'Caracole',
  description: 'A sculptural table.', productType: 'Tables', publishedAt: '2026-08-01T00:00:00Z', createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-08-02T00:00:00Z', availableForSale: true,
  featuredImage: { url: 'https://cdn.example/luna.jpg' }, images: { nodes: [{ url: 'https://cdn.example/luna.jpg' }, { url: 'https://cdn.example/luna-detail.jpg' }] },
  metafield: { value: 'Bedroom > Vanity/Desks' }, selectedOrFirstAvailableVariant: { id: 'gid://shopify/ProductVariant/1', sku: 'ABC-123', availableForSale: true, price: { amount: '42000.00', currencyCode: 'PHP' } },
}

test('parses supported main and subcategories', () => {
  assert.deepEqual(parseProductCategory('Bedroom > Vanity/Desks'), { category: 'Bedroom', subcategory: 'Vanity/Desks' })
  assert.equal(parseProductCategory('Office > Desks'), null)
  assert.equal(parseProductCategory(null), null)
})

test('normalizes a Caracole Shopify product and excludes invalid products', () => {
  const product = normalizeShopifyProduct(sourceProduct)
  assert.equal(product.id, sourceProduct.id)
  assert.equal(product.handle, 'luna-table')
  assert.equal(product.edpNumber, 'ABC-123')
  assert.equal(product.displayCategory, 'Bedroom')
  assert.equal(product.subcategory, 'Vanity/Desks')
  assert.equal(product.stockQuantity, 1)
  assert.deepEqual(product.images, ['https://cdn.example/luna.jpg', 'https://cdn.example/luna-detail.jpg'])
  assert.equal(normalizeShopifyProduct({ ...sourceProduct, vendor: 'Other' }), null)
  assert.equal(normalizeShopifyProduct({ ...sourceProduct, metafield: null }), null)
})

test('retrieves all Shopify pages and filters malformed catalog records', async () => {
  const responses = [
    { data: { products: { nodes: [sourceProduct], pageInfo: { hasNextPage: true, endCursor: 'cursor-1' } } } },
    { data: { products: { nodes: [{ ...sourceProduct, id: 'gid://shopify/Product/2', handle: 'excluded', metafield: null }], pageInfo: { hasNextPage: false, endCursor: null } } } },
  ]
  const requests = []
  const service = createShopifyProductsService(config, { request: async (_operation, options) => { requests.push(options.variables); return responses.shift() } })
  const products = await service.getAll()
  assert.equal(products.length, 1)
  assert.equal(requests.length, 2)
  assert.equal(requests[0].first, 100)
  assert.equal(requests[1].first, 100)
  assert.equal(requests[0].query, 'vendor:Caracole')
  assert.equal(requests[1].after, 'cursor-1')
})

test('translates Shopify GraphQL failures into a safe catalog error', async () => {
  const service = createShopifyProductsService(config, { request: async () => ({ errors: { graphQLErrors: [{ message: 'Access denied' }] } }) })
  await assert.rejects(service.getAll(), (error) => error instanceof ShopifyProductsError && error.message === 'Access denied')
})
