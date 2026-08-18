import { createStorefrontApiClient } from '@shopify/storefront-api-client'

const SITE_CATEGORIES = new Set(['Living', 'Dining', 'Bedroom', 'Mirrors & Accessories', 'Entertainment'])
const PRODUCTS_PAGE_SIZE = 100

const PRODUCTS_QUERY = `#graphql
  query CaracoleProducts($first: Int!, $after: String, $query: String!) {
    products(first: $first, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id handle title vendor description productType publishedAt createdAt updatedAt availableForSale
        featuredImage { url altText }
        images(first: 20) { nodes { url altText } }
        metafield(namespace: "__NAMESPACE__", key: "__KEY__") { value }
        selectedOrFirstAvailableVariant { id sku availableForSale price { amount currencyCode } }
      }
    }
  }
`

export class ShopifyProductsError extends Error {
  constructor(message, status = 502) {
    super(message)
    this.status = status
  }
}

export function parseProductCategory(value) {
  if (typeof value !== 'string') return null
  const [categoryPart, ...subcategoryParts] = value.split('>').map((part) => part.trim())
  if (!SITE_CATEGORIES.has(categoryPart)) return null
  const subcategory = subcategoryParts.join(' > ').trim()
  return { category: categoryPart, subcategory: subcategory || '--' }
}

export function normalizeShopifyProduct(product, vendor = 'Caracole') {
  const category = parseProductCategory(product.metafield?.value)
  if (!category || product.vendor !== vendor) return null
  const variant = product.selectedOrFirstAvailableVariant
  const images = [...new Set([
    product.featuredImage?.url,
    ...(product.images?.nodes ?? []).map((image) => image.url),
  ].filter(Boolean))]
  const sku = variant?.sku?.trim() || '--'
  const priceValue = Number(variant?.price?.amount)

  return {
    id: product.id,
    handle: product.handle,
    name: product.title,
    edpNumber: sku,
    articleNumber: sku,
    description: product.description || '',
    finish: '--',
    size: '--',
    categories: [category.category],
    primaryCategory: category.category,
    displayCategory: category.category,
    subcategory: category.subcategory,
    series: product.productType || '--',
    price: Number.isFinite(priceValue) ? `${variant.price.currencyCode} ${priceValue}` : '--',
    priceValue: Number.isFinite(priceValue) ? priceValue : 0,
    currencyCode: variant?.price?.currencyCode || 'PHP',
    catalogOrder: 0,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    publishedAt: product.publishedAt,
    arrivalDate: product.publishedAt,
    isNewArrival: true,
    isActive: true,
    isComingSoon: false,
    image: images[0] || null,
    images,
    productUrl: `/product/${encodeURIComponent(product.handle)}`,
    stockQuantity: product.availableForSale && variant?.availableForSale ? 1 : 0,
    origin: 'Not specified',
  }
}

function graphqlErrorMessage(errors) {
  return errors?.graphQLErrors?.[0]?.message || errors?.message || 'Shopify catalog is unavailable'
}

export function createShopifyProductsService(config, client = null) {
  const storefront = client || createStorefrontApiClient({
    storeDomain: config.SHOPIFY_STORE_DOMAIN,
    apiVersion: config.SHOPIFY_STOREFRONT_API_VERSION,
    privateAccessToken: config.SHOPIFY_PRIVATE_ACCESS_TOKEN,
    customFetchApi: globalThis.fetch,
    retries: 2,
    clientName: 'caracole-ph-catalog',
  })
  const operation = PRODUCTS_QUERY
    .replace('__NAMESPACE__', config.SHOPIFY_PRODUCT_CATEGORY_METAFIELD_NAMESPACE)
    .replace('__KEY__', config.SHOPIFY_PRODUCT_CATEGORY_METAFIELD_KEY)

  async function getAll() {
    const products = []
    let after = null
    do {
      const { data, errors } = await storefront.request(operation, {
        variables: { first: PRODUCTS_PAGE_SIZE, after, query: `vendor:${config.SHOPIFY_VENDOR}` },
      })
      if (errors) throw new ShopifyProductsError(graphqlErrorMessage(errors))
      const connection = data?.products
      if (!connection) throw new ShopifyProductsError('Shopify returned an invalid catalog response')
      products.push(...connection.nodes.map((product) => normalizeShopifyProduct(product, config.SHOPIFY_VENDOR)).filter(Boolean))
      after = connection.pageInfo?.hasNextPage ? connection.pageInfo.endCursor : null
    } while (after)
    return products
  }

  return {
    getAll,
    async getByHandle(handle) {
      const product = (await getAll()).find((item) => item.handle === handle)
      return product || null
    },
  }
}
