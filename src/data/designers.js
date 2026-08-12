import details from '../../assets/designers/details.json'

const designerAssets = import.meta.glob([
  '../../assets/designers/images/**/banner.*',
  '../../assets/designers/images/**/display_picture.*',
  '../../assets/designers/images/**/featured_product_*.*',
], {
  eager: true,
  query: '?url',
  import: 'default',
})

function assetUrl(path) {
  const normalizedPath = String(path).replaceAll('\\', '/').replace(/^\/+/, '')
  const modulePath = `../../${normalizedPath}`
  const resolvedAsset = designerAssets[modulePath]

  if (!resolvedAsset) {
    throw new Error(`Designer asset not found: "${path}". Check assets/designers/details.json and the referenced file.`)
  }

  return resolvedAsset
}

function cleanText(value) {
  return String(value).replaceAll('â€”', '—').replaceAll('â€™', '’')
}

export const designers = Object.entries(details).map(([slug, designer]) => ({
  slug,
  name: cleanText(designer.name),
  banner: assetUrl(designer.banner),
  image: assetUrl(designer.image),
  link: designer.link,
  introDescription: cleanText(designer.intro_description),
  profileDescription: cleanText(designer.profile_description),
  featuredProducts: designer.featured_products.map((product) => ({
    name: cleanText(product.name),
    image: assetUrl(product.image),
    description: cleanText(product.description),
  })),
}))

export function getDesignerBySlug(slug) {
  return designers.find((designer) => designer.slug === slug) ?? null
}
