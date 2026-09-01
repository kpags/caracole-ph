import { parseProductCategory } from './shopify-products.js'
import { createShopifyAdminTokenProvider } from './shopify-admin-token.js'
import { normalizeDisplayMetafieldValue } from './shopify-metafield-normalization.js'
import { extractShopifyProductAttributeValues, shopifyProductAttributeDefinitions } from './shopify-product-attributes.js'

const ADMIN_PRODUCTS_QUERY = `#graphql
  query AdminProducts($after: String, $query: String!) {
    products(first: 50, after: $after, query: $query, sortKey: UPDATED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id handle title vendor description descriptionHtml productType tags status createdAt updatedAt publishedAt totalInventory
        seo { title description }
        featuredImage { id url altText width height }
        images(first: 250) { nodes { id url altText width height } }
        options { id name position values }
        variants(first: 250) { nodes { id title sku barcode availableForSale inventoryQuantity price compareAtPrice selectedOptions { name value } image { id url altText } createdAt updatedAt } }
        media(first: 250) { nodes { id alt mediaContentType preview { image { id url altText width height } } } }
        metafields(first: 250) { pageInfo { hasNextPage endCursor } nodes { id namespace key type value jsonValue description reference { __typename } } }
      }
    }
  }
`

const PRODUCT_METAFIELDS_QUERY = `#graphql
  query ProductMetafields($id: ID!, $after: String) {
    product(id: $id) {
      metafields(first: 250, after: $after) { pageInfo { hasNextPage endCursor } nodes { id namespace key type value jsonValue description reference { __typename } } }
    }
  }
`

function toDate(value) { return value ? new Date(value) : null }

function metafieldRecord(metafields) {
  return Object.fromEntries(metafields.map((field) => {
    const key = `${field.namespace}.${field.key}`
    return [key, {
    id: field.id, namespace: field.namespace, key: field.key, type: field.type, value: normalizeDisplayMetafieldValue(key, field.value),
    jsonValue: field.jsonValue, description: field.description, referenceType: field.reference?.__typename || null,
  }]
  }))
}

function productData(product) {
  const metafields = metafieldRecord(product.metafields.nodes)
  const attributes = extractShopifyProductAttributeValues(metafields)
  for (const attribute of shopifyProductAttributeDefinitions) delete metafields[attribute.metafieldKey]
  const category = parseProductCategory(metafields['custom.categories']?.value)
  const selectedVariant = product.variants.nodes.find((variant) => variant.availableForSale) || product.variants.nodes[0] || null
  const images = product.images.nodes
  return {
    attributes,
    shopifyId: product.id,
    handle: product.handle,
    vendor: product.vendor,
    title: product.title,
    description: product.description || '',
    descriptionHtml: product.descriptionHtml || '',
    productType: product.productType || '',
    tags: product.tags || [],
    status: product.status,
    seoTitle: product.seo?.title || null,
    seoDescription: product.seo?.description || null,
    mainCategory: category?.category || null,
    subcategory: category?.subcategory || null,
    sku: selectedVariant?.sku || null,
    price: selectedVariant?.price || null,
    currencyCode: selectedVariant?.price ? 'PHP' : null,
    availableForSale: Boolean(selectedVariant?.availableForSale),
    totalInventory: product.totalInventory ?? null,
    featuredImageUrl: product.featuredImage?.url || images[0]?.url || null,
    featuredImageAlt: product.featuredImage?.altText || images[0]?.altText || null,
    images,
    options: product.options || [],
    variants: product.variants.nodes,
    media: product.media.nodes,
    metafields,
    shopifyData: product,
    shopifyCreatedAt: toDate(product.createdAt),
    shopifyUpdatedAt: toDate(product.updatedAt),
    publishedAt: toDate(product.publishedAt),
    isActive: product.status === 'ACTIVE',
    lastSyncedAt: new Date(),
  }
}

async function syncProductAttributeValues(prisma, productId, attributeRecords, values) {
  const valueByKey = new Map(values.map((value) => [value.key, value]))
  const removedAttributeIds = [...attributeRecords.values()]
    .filter((attribute) => !valueByKey.has(attribute.key))
    .map((attribute) => attribute.id)
  if (removedAttributeIds.length) {
    await prisma.productAttributeValue.deleteMany({ where: { productId, attributeId: { in: removedAttributeIds } } })
  }
  await Promise.all([...valueByKey].map(([key, record]) => {
    const attribute = attributeRecords.get(key)
    return prisma.productAttributeValue.upsert({
      where: { productId_attributeId: { productId, attributeId: attribute.id } },
      create: { productId, attributeId: attribute.id, value: record.value, numericValue: record.numericValue },
      update: { value: record.value, numericValue: record.numericValue }
    })
  }))
}

async function requestAdmin(config, tokenProvider, query, variables) {
  const accessToken = await tokenProvider.getAccessToken()
  const response = await fetch(`https://${config.SHOPIFY_STORE_DOMAIN}/admin/api/${config.SHOPIFY_STOREFRONT_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
    body: JSON.stringify({ query, variables }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.errors) throw new Error(payload.errors?.map((error) => error.message).join('; ') || `Shopify Admin API request failed (${response.status})`)
  return payload.data
}

async function loadAllMetafields({ config, tokenProvider, product }) {
  const metafields = [...product.metafields.nodes]
  let after = product.metafields.pageInfo?.hasNextPage ? product.metafields.pageInfo.endCursor : null
  while (after) {
    const data = await requestAdmin(config, tokenProvider, PRODUCT_METAFIELDS_QUERY, { id: product.id, after })
    const connection = data?.product?.metafields
    if (!connection) throw new Error(`Shopify returned invalid metafields for ${product.handle}`)
    metafields.push(...connection.nodes)
    after = connection.pageInfo?.hasNextPage ? connection.pageInfo.endCursor : null
  }
  return metafields
}

export async function syncShopifyProducts({ prisma, config, tokenProvider = createShopifyAdminTokenProvider(config) }) {
  const lock = await prisma.$queryRaw`SELECT pg_try_advisory_lock(841108) AS acquired`
  if (!lock[0]?.acquired) throw new Error('A Shopify product sync is already running')
  const startedAt = new Date()
  const run = await prisma.catalogSyncRun.create({ data: { status: 'RUNNING' } })
  let fetchedCount = 0
  let createdCount = 0
  let updatedCount = 0
  try {
    const attributeRecords = new Map((await Promise.all(shopifyProductAttributeDefinitions.map((attribute) =>
      prisma.attribute.upsert({
        where: { key: attribute.key },
        create: { key: attribute.key, name: attribute.name },
        update: { name: attribute.name }
      })
    ))).map((attribute) => [attribute.key, attribute]))
    let after = null
    do {
      const data = await requestAdmin(config, tokenProvider, ADMIN_PRODUCTS_QUERY, { after, query: `vendor:${config.SHOPIFY_VENDOR}` })
      const connection = data?.products
      if (!connection) throw new Error('Shopify returned an invalid products response')
      for (const shopifyProduct of connection.nodes) {
        shopifyProduct.metafields.nodes = await loadAllMetafields({ config, tokenProvider, product: shopifyProduct })
        const { attributes, ...data } = productData(shopifyProduct)
        const existing = await prisma.product.findUnique({ where: { shopifyId: data.shopifyId }, select: { id: true } })
        const product = await prisma.product.upsert({ where: { shopifyId: data.shopifyId }, create: data, update: data })
        await syncProductAttributeValues(prisma, product.id, attributeRecords, attributes)
        if (existing) updatedCount += 1
        else createdCount += 1
        fetchedCount += 1
      }
      after = connection.pageInfo?.hasNextPage ? connection.pageInfo.endCursor : null
    } while (after)

    const hidden = await prisma.product.updateMany({
      where: { vendor: config.SHOPIFY_VENDOR, isActive: true, lastSyncedAt: { lt: startedAt } },
      data: { isActive: false },
    })
    await prisma.catalogSyncRun.update({ where: { id: run.id }, data: { status: 'COMPLETED', finishedAt: new Date(), fetchedCount, createdCount, updatedCount, deactivatedCount: hidden.count } })
    return { fetchedCount, createdCount, updatedCount, deactivatedCount: hidden.count }
  } catch (error) {
    await prisma.catalogSyncRun.update({ where: { id: run.id }, data: { status: 'FAILED', finishedAt: new Date(), fetchedCount, createdCount, updatedCount, error: error.message } })
    throw error
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(841108)`
  }
}
