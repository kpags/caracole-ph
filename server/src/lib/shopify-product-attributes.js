export const shopifyProductAttributeDefinitions = [
  { key: 'finish', name: 'Finish', metafieldKey: 'custom.finish' },
  { key: 'size', name: 'Size', metafieldKey: 'custom.size' },
  { key: 'table', name: 'Table', metafieldKey: 'custom.table' },
  { key: 'seating', name: 'Seating', metafieldKey: 'custom.seating' },
  { key: 'drawer_door_details', name: 'Drawer / Door Details', metafieldKey: 'custom.drawer_door_details' },
  { key: 'bedroom_details', name: 'Bedroom Details', metafieldKey: 'custom.bedroom_details' },
  { key: 'upholstery', name: 'Upholstery', metafieldKey: 'custom.upholstery' },
  { key: 'base_legs', name: 'Base / Legs', metafieldKey: 'custom.base_legs' },
  { key: 'material', name: 'Material', metafieldKey: 'custom.material' },
  { key: 'function', name: 'Function', metafieldKey: 'custom.function' },
  { key: 'storage', name: 'Storage', metafieldKey: 'custom.storage' },
  { key: 'height', name: 'Height', metafieldKey: 'custom.height' },
  { key: 'depth', name: 'Depth', metafieldKey: 'custom.depth' },
  { key: 'width', name: 'Width', metafieldKey: 'custom.width' },
  { key: 'diameter', name: 'Diameter', metafieldKey: 'custom.diameter' }
]

export const dimensionAttributeKeys = new Set(['diameter', 'width', 'depth', 'height'])

export function numericProductAttributeValue(key, value) {
  if (!dimensionAttributeKeys.has(key) || typeof value !== 'string') return null
  const numeric = Number(value.match(/-?\d+(?:\.\d+)?/)?.[0])
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null
}

export function extractShopifyProductAttributeValues(metafields) {
  return shopifyProductAttributeDefinitions
    .map((attribute) => {
      const value = metafields[attribute.metafieldKey]?.value?.trim?.() || ''
      return { ...attribute, value, numericValue: numericProductAttributeValue(attribute.key, value) }
    })
    .filter((attribute) => attribute.value)
}
