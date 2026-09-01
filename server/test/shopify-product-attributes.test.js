import test from 'node:test'
import assert from 'node:assert/strict'
import { extractShopifyProductAttributeValues } from '../src/lib/shopify-product-attributes.js'

test('extracts product filtering metafields as relational attributes', () => {
  assert.deepEqual(extractShopifyProductAttributeValues({
    'custom.finish': { value: 'Dry Martini, Cloud' },
    'custom.size': { value: '170.752W x 68D x 75H CM' },
    'custom.material': { value: 'Metal Accents; Stone / Marble' },
    'custom.height': { value: '74.93 CM' },
    'custom.series': { value: 'Leaf' }
  }), [
    { key: 'finish', name: 'Finish', metafieldKey: 'custom.finish', value: 'Dry Martini, Cloud', numericValue: null },
    { key: 'size', name: 'Size', metafieldKey: 'custom.size', value: '170.752W x 68D x 75H CM', numericValue: null },
    { key: 'material', name: 'Material', metafieldKey: 'custom.material', value: 'Metal Accents; Stone / Marble', numericValue: null },
    { key: 'height', name: 'Height', metafieldKey: 'custom.height', value: '74.93 CM', numericValue: 74.93 }
  ])
})

test('does not create empty product attribute values', () => {
  assert.deepEqual(extractShopifyProductAttributeValues({ 'custom.finish': { value: '  ' } }), [])
})
