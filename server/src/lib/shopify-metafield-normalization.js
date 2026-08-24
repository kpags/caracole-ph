const DISPLAY_STRING_METAFIELDS = new Set(['custom.finish', 'custom.size'])

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
