import test from 'node:test'
import assert from 'node:assert/strict'
import { filterAdminProducts, serializeAdminProduct } from '../src/routes/admin-products.js'

const product = {
  id: '0f6dbb63-4a7a-4e36-8428-d18413991a44', shopifyId: 'gid://shopify/Product/1', handle: 'room-to-move',
  title: 'A Room to Move', description: 'A sculptural lounge chair.', mainCategory: 'Living', subcategory: 'Seating',
  sku: 'EDP-1024', price: '125000', currencyCode: 'PHP', featuredImageUrl: null, images: [{ url: 'https://example.com/chair.jpg' }],
  metafields: { 'custom.series': { value: 'Leaf' }, 'custom.article_number': { value: 'ART-7' } },
  attributeValues: [
    { value: 'Dry Martini, Cloud', attribute: { key: 'finish', name: 'Finish' } },
    { value: '170.752W x 68D x 75H CM', attribute: { key: 'size', name: 'Size' } }
  ], productType: 'Chair', updatedAt: new Date()
}

test('serializes local product data for the admin catalog', () => {
  const result = serializeAdminProduct(product)
  assert.equal(result.edpNumber, 'EDP-1024')
  assert.equal(result.articleNumber, 'ART-7')
  assert.equal(result.series, 'Leaf')
  assert.equal(result.image, 'https://example.com/chair.jpg')
  assert.deepEqual(result.attributes, [
    { key: 'finish', name: 'Finish', value: 'Dry Martini, Cloud' },
  ])
})

test('filters local product catalog by category, series, SRP, and searchable identifiers', () => {
  const filtered = filterAdminProducts([product], { category: 'Living', subcategory: 'Seating', series: 'Leaf', minPrice: 120000, maxPrice: 130000, search: 'art-7' })
  assert.equal(filtered.length, 1)
  assert.equal(filterAdminProducts([product], { search: 'not-present' }).length, 0)
  assert.equal(serializeAdminProduct({ ...product, metafields: {} }).articleNumber, '--')
})
