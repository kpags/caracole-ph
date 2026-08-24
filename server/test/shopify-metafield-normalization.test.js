import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeDisplayMetafieldValue } from '../src/lib/shopify-metafield-normalization.js'

test('keeps scalar Finish and Size values unchanged', () => {
  assert.equal(normalizeDisplayMetafieldValue('custom.finish', 'Brushed Gold'), 'Brushed Gold')
  assert.equal(normalizeDisplayMetafieldValue('custom.size', '170.752W x 68D x 75H CM'), '170.752W x 68D x 75H CM')
})

test('converts Finish and Size list values into readable strings', () => {
  assert.equal(normalizeDisplayMetafieldValue('custom.finish', '["Dry Martini", "Cloud", " ", "Charcoal Leaf & Brushed Gold"]'), 'Dry Martini, Cloud, Charcoal Leaf & Brushed Gold')
  assert.equal(normalizeDisplayMetafieldValue('custom.size', '["170.752W x 68D x 75H CM"]'), '170.752W x 68D x 75H CM')
})

test('safely preserves malformed values and leaves unrelated metafields alone', () => {
  assert.equal(normalizeDisplayMetafieldValue('custom.finish', '["Dry Martini"'), '["Dry Martini"')
  assert.equal(normalizeDisplayMetafieldValue('custom.series', '["Leaf"]'), '["Leaf"]')
  assert.equal(normalizeDisplayMetafieldValue('custom.size', '[]'), '')
})
