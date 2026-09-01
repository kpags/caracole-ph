const DISPLAY_STRING_METAFIELDS = new Set([
  'custom.finish',
  'custom.size',
  'custom.table',
  'custom.seating',
  'custom.drawer_door_details',
  'custom.bedroom_details',
  'custom.upholstery',
  'custom.base_legs',
  'custom.material',
  'custom.function',
  'custom.storage',
  'custom.height',
  'custom.depth',
  'custom.width',
  'custom.diameter'
])

export function normalizeDisplayMetafieldValue(key, value) {
  if (!DISPLAY_STRING_METAFIELDS.has(key) || typeof value !== 'string') return value

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return value
    return parsed
      .filter((item) => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
      .join(', ')
  } catch {
    return value
  }
}
