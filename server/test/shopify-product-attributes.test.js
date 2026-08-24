import test from 'node:test'
import assert from 'node:assert/strict'
import { extractShopifyProductAttributeValues } from '../src/lib/shopify-product-attributes.js'

test('extracts Finish and Size as relational product attributes', () => {
  assert.deepEqual(extractShopifyProductAttributeValues({
    'custom.finish': { value: 'Dry Martini, Cloud' },
    'custom.size': { value: '170.752W x 68D x 75H CM' },
    'custom.series': { value: 'Leaf' }
  }), [
    { key: 'finish', name: 'Finish', metafieldKey: 'custom.finish', value: 'Dry Martini, Cloud' },
    { key: 'size', name: 'Size', metafieldKey: 'custom.size', value: '170.752W x 68D x 75H CM' }
  ])
})

test('does not create empty product attribute values', () => {
  assert.deepEqual(extractShopifyProductAttributeValues({ 'custom.finish': { value: '  ' } }), [])
})
