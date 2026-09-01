export const dimensionFilterKeys = ['diameter', 'width', 'depth', 'height']

const categoryAttributeKeys = {
  Bedroom: ['storage', 'function', 'material', 'base_legs', 'upholstery', 'bedroom_details', 'drawer_door_details'],
  Living: ['storage', 'function', 'material', 'base_legs', 'seating', 'upholstery', 'drawer_door_details'],
  Dining: ['storage', 'function', 'material', 'base_legs', 'table', 'upholstery', 'drawer_door_details'],
}

const attributeLabels = {
  finish: 'Finish',
  material: 'Materials',
  storage: 'Storage',
  function: 'Function',
  base_legs: 'Base / Legs',
  upholstery: 'Upholstery',
  bedroom_details: 'Bedroom Details',
  drawer_door_details: 'Drawer / Door Details',
  seating: 'Seating',
  table: 'Table',
}

const allAttributeKeys = [...new Set(Object.values(categoryAttributeKeys).flat())]

export function attributeKeysForCategory(category) {
  return ['finish', ...(categoryAttributeKeys[category] || allAttributeKeys)]
}

export function catalogAttributeLabel(key, fallback = key) {
  return attributeLabels[key] || fallback
}

export function tokenizeProductAttributeValue(value) {
  return [...new Set(String(value || '')
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter((item) => item && item !== '--'))]
}

export function parseCatalogAttributeFilters(input) {
  const entries = Array.isArray(input) ? input : input ? [input] : []
  const allowedKeys = new Set(allAttributeKeys.concat('finish'))
  const filters = new Map()

  for (const entry of entries) {
    const separator = entry.indexOf(':')
    const key = entry.slice(0, separator).trim()
    const value = entry.slice(separator + 1).trim()
    if (separator < 1 || !allowedKeys.has(key) || !value || value.length > 120) {
      throw new Error('Invalid product attribute filter')
    }
    if (!filters.has(key)) filters.set(key, [])
    if (!filters.get(key).includes(value)) filters.get(key).push(value)
  }

  return filters
}

export function productAttributeFilterWhere(filters, dimensions) {
  const conditions = []
  for (const [key, values] of filters) {
    conditions.push({
      attributeValues: {
        some: {
          attribute: { key },
          OR: values.map((value) => ({ value: { contains: value, mode: 'insensitive' } })),
        },
      },
    })
  }

  for (const key of dimensionFilterKeys) {
    const range = dimensions[key]
    if (range.min === undefined && range.max === undefined) continue
    conditions.push({
      attributeValues: {
        some: {
          attribute: { key },
          numericValue: {
            ...(range.min !== undefined ? { gte: range.min } : {}),
            ...(range.max !== undefined ? { lte: range.max } : {}),
          },
        },
      },
    })
  }
  return conditions
}
