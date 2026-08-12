const MATERIALS = [
  ['Marble & Stone', /marble|stone|travertine|onyx|quartz|granite/i],
  ['Glass', /glass|crystal/i],
  ['Metal', /metal|steel|iron|bronze|brass|aluminum|aluminium|nickel/i],
  ['Wood', /wood|oak|walnut|maple|mahogany|veneer|ebony|birch|ash\b/i],
  ['Leather', /leather|hide/i],
  ['Upholstered', /upholster|fabric|velvet|boucl|linen|chenille|jacquard|suede/i],
  ['Acrylic', /acrylic|lucite/i],
  ['Cane & Rattan', /cane|rattan|wicker/i],
]

const COLORS = [
  ['Black', /black|ebony|charcoal/i], ['White', /white|ivory|snow/i],
  ['Gold', /gold|gilt|champagne/i], ['Silver', /silver|platinum|pewter/i],
  ['Bronze', /bronze|brass|copper/i], ['Brown', /brown|walnut|mocha|chocolate|espresso/i],
  ['Beige & Cream', /beige|cream|taupe|sand|camel|oat/i], ['Grey', /grey|gray|graphite/i],
  ['Blue', /blue|navy|azure|indigo/i], ['Green', /green|olive|sage|emerald/i],
  ['Red', /red|burgundy|wine|scarlet/i], ['Pink', /pink|blush|rose/i],
  ['Orange', /orange|terracotta|rust/i], ['Yellow', /yellow|mustard/i],
  ['Natural', /natural|clear|transparent/i],
]

const FABRICS = [
  ['Velvet', /velvet/i], ['Bouclé', /boucl[eé]/i], ['Linen', /linen/i],
  ['Leather', /leather|hide/i], ['Chenille', /chenille/i], ['Jacquard', /jacquard/i],
  ['Suede', /suede/i], ['Cotton', /cotton/i], ['Woven', /woven|weave/i],
]

function searchable(product) {
  return [product.name, product.finish, product.description, product.series].filter(Boolean).join(' ')
}

function matches(text, definitions) {
  return definitions.filter(([, pattern]) => pattern.test(text)).map(([label]) => label)
}

export function getSizeGroup(product) {
  const firstMeasurement = Number(String(product.size ?? '').match(/\d+(?:\.\d+)?/)?.[0])
  if (!firstMeasurement) return 'Unspecified'
  if (firstMeasurement <= 60) return 'Small'
  if (firstMeasurement <= 120) return 'Medium'
  if (firstMeasurement <= 180) return 'Large'
  return 'Oversized'
}

export function getProductFacets(product) {
  const text = searchable(product)
  return {
    size: getSizeGroup(product),
    finishes: String(product.finish ?? '').split(',').map((value) => value.trim()).filter((value) => value && value !== '--'),
    materials: matches(text, MATERIALS),
    colors: matches(text, COLORS),
    fabrics: matches(text, FABRICS),
  }
}

export function productTimestamp(product) {
  const value = product.arrivalDate || product.createdAt || product.updatedAt
  const timestamp = value ? Date.parse(value) : Number.NaN
  return Number.isFinite(timestamp) ? timestamp : -Number(product.catalogOrder ?? 0)
}
