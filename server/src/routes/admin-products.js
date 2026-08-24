import express from 'express'
import { z } from 'zod'
import { asyncRoute, HttpError } from '../lib/http.js'

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  category: z.string().trim().min(1).max(80).optional(),
  subcategory: z.string().trim().min(1).max(120).optional(),
  series: z.string().trim().min(1).max(160).optional(),
  search: z.string().trim().min(1).max(120).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional()
}).refine((query) => query.minPrice === undefined || query.maxPrice === undefined || query.minPrice <= query.maxPrice, {
  message: 'Minimum SRP must not exceed maximum SRP'
})

const filtersQuery = z.object({
  category: z.string().trim().min(1).max(80).optional()
})

const productSelect = {
  id: true,
  shopifyId: true,
  handle: true,
  title: true,
  description: true,
  mainCategory: true,
  subcategory: true,
  sku: true,
  price: true,
  currencyCode: true,
  featuredImageUrl: true,
  images: true,
  metafields: true,
  attributeValues: { select: { value: true, attribute: { select: { key: true, name: true } } }, orderBy: { attribute: { key: 'asc' } } },
  productType: true,
  updatedAt: true
}

function metafieldValue(product, key) {
  return product.metafields?.[key]?.value?.trim?.() || ''
}

function seriesFor(product) {
  return metafieldValue(product, 'custom.series') || product.productType?.trim() || '--'
}

function articleNumberFor(product) {
  return metafieldValue(product, 'custom.article_number') || '--'
}

function imageFor(product) {
  const images = Array.isArray(product.images) ? product.images : []
  return product.featuredImageUrl || images[0]?.url || null
}

export function serializeAdminProduct(product) {
  const numericPrice = product.price === null || product.price === undefined ? null : Number(product.price)
  return {
    id: product.id,
    shopifyId: product.shopifyId,
    handle: product.handle,
    name: product.title,
    edpNumber: product.sku || '--',
    articleNumber: articleNumberFor(product),
    mainCategory: product.mainCategory || '--',
    subcategory: product.subcategory || '--',
    series: seriesFor(product),
    srp: numericPrice,
    currencyCode: product.currencyCode || 'PHP',
    image: imageFor(product),
    description: product.description || '',
    attributes: (product.attributeValues || []).map(({ attribute, value }) => ({ key: attribute.key, name: attribute.name, value })),
    updatedAt: product.updatedAt
  }
}

export function filterAdminProducts(products, query) {
  const search = query.search?.toLocaleLowerCase()
  return products.filter((product) => {
    const item = serializeAdminProduct(product)
    if (query.category && item.mainCategory !== query.category) return false
    if (query.subcategory && item.subcategory !== query.subcategory) return false
    if (query.series && item.series !== query.series) return false
    if (query.minPrice !== undefined && (item.srp === null || item.srp < query.minPrice)) return false
    if (query.maxPrice !== undefined && (item.srp === null || item.srp > query.maxPrice)) return false
    if (!search) return true
    return [item.name, item.edpNumber, item.articleNumber].some((value) => value.toLocaleLowerCase().includes(search))
  })
}

function alphabetical(values) {
  return [...new Set(values.filter((value) => value && value !== '--'))].sort((left, right) => left.localeCompare(right))
}

export function adminProductsRoutes({ prisma, authenticate, authorize }) {
  const router = express.Router()
  router.use(authenticate, authorize('staff'))

  router.get('/filter-options', asyncRoute(async (req, res) => {
    const query = filtersQuery.parse(req.query)
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: { mainCategory: true, subcategory: true, productType: true, metafields: true }
    })
    const matchingProducts = products.filter((product) => !query.category || product.mainCategory === query.category)
    res.json({
      categories: alphabetical(products.map((product) => product.mainCategory)),
      subcategories: alphabetical(matchingProducts.map((product) => product.subcategory)),
      series: alphabetical(matchingProducts.map(seriesFor))
    })
  }))

  router.get('/', asyncRoute(async (req, res) => {
    const query = listQuery.parse(req.query)
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: productSelect,
      orderBy: [{ title: 'asc' }, { id: 'asc' }]
    })
    const matches = filterAdminProducts(products, query)
    const totalItems = matches.length
    const pageProducts = matches.slice((query.page - 1) * query.limit, query.page * query.limit)
    res.json({
      products: pageProducts.map(serializeAdminProduct),
      pagination: { page: query.page, limit: query.limit, totalItems, totalPages: Math.ceil(totalItems / query.limit) }
    })
  }))

  router.get('/:id', asyncRoute(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id)
    const product = await prisma.product.findFirst({ where: { id, isActive: true }, select: productSelect })
    if (!product) throw new HttpError(404, 'Product not found')
    res.json({ product: serializeAdminProduct(product) })
  }))

  return router
}
