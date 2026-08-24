export const shopifyProductAttributeDefinitions = [
  { key: 'finish', name: 'Finish', metafieldKey: 'custom.finish' },
  { key: 'size', name: 'Size', metafieldKey: 'custom.size' }
]

export function extractShopifyProductAttributeValues(metafields) {
  return shopifyProductAttributeDefinitions
    .map((attribute) => ({ ...attribute, value: metafields[attribute.metafieldKey]?.value?.trim?.() || '' }))
    .filter((attribute) => attribute.value)
}
