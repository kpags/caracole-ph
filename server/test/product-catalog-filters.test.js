import test from 'node:test'
import assert from 'node:assert/strict'
import { attributeKeysForCategory, parseCatalogAttributeFilters, productAttributeFilterWhere, tokenizeProductAttributeValue } from '../src/lib/product-catalog-filters.js'

test('uses only the populated workbook attributes for each main category', () => {
  assert.deepEqual(attributeKeysForCategory('Bedroom'), ['finish', 'storage', 'function', 'material', 'base_legs', 'upholstery', 'bedroom_details', 'drawer_door_details'])
  assert.deepEqual(attributeKeysForCategory('Living'), ['finish', 'storage', 'function', 'material', 'base_legs', 'seating', 'upholstery', 'drawer_door_details'])
  assert.deepEqual(attributeKeysForCategory('Dining'), ['finish', 'storage', 'function', 'material', 'base_legs', 'table', 'upholstery', 'drawer_door_details'])
})

test('splits multi-value Shopify attributes into unique checkbox choices', () => {
  assert.deepEqual(tokenizeProductAttributeValue('Drawers; Doors, Shelves; Drawers'), ['Drawers', 'Doors', 'Shelves'])
})

test('builds database-side attribute and dimension constraints', () => {
  const filters = parseCatalogAttributeFilters(['material:Metal Accents', 'material:Stone / Marble', 'storage:Drawers'])
  assert.deepEqual(productAttributeFilterWhere(filters, {
    diameter: {}, width: { min: 100, max: 200 }, depth: {}, height: {},
  }), [
    { attributeValues: { some: { attribute: { key: 'material' }, OR: [{ value: { contains: 'Metal Accents', mode: 'insensitive' } }, { value: { contains: 'Stone / Marble', mode: 'insensitive' } }] } } },
    { attributeValues: { some: { attribute: { key: 'storage' }, OR: [{ value: { contains: 'Drawers', mode: 'insensitive' } }] } } },
    { attributeValues: { some: { attribute: { key: 'width' }, numericValue: { gte: 100, lte: 200 } } } },
  ])
})
