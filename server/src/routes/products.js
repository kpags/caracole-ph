import express from 'express'
import { z } from 'zod'
import { asyncRoute, HttpError } from '../lib/http.js'

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(24),
  category: z.string().trim().min(1).max(80).optional(), subcategory: z.string().trim().min(1).max(120).optional(),
  search: z.string().trim().min(1).max(120).optional(), inStock: z.enum(['true', 'false']).optional(),
  minPrice: z.coerce.number().min(0).optional(), maxPrice: z.coerce.number().min(0).optional(),
  sort: z.enum(['latest', 'oldest', 'name-asc', 'name-desc', 'price-asc', 'price-desc']).default('latest'),
}).refine((query) => query.minPrice === undefined || query.maxPrice === undefined || query.minPrice <= query.maxPrice, { message: 'minPrice must not exceed maxPrice' })

function serializeProduct(product) {
  const images = Array.isArray(product.images) ? product.images : []
  const attributes = (product.attributeValues || []).map(({ attribute, value }) => ({ key: attribute.key, name: attribute.name, value }))
  return { id: product.shopifyId, recordId: product.id, handle: product.handle, name: product.title, edpNumber: product.sku || '--', articleNumber: product.sku || '--', description: product.description,
    attributes, categories: product.mainCategory ? [product.mainCategory] : [], primaryCategory: product.mainCategory, displayCategory: product.mainCategory,
    subcategory: product.subcategory || '--', series: product.metafields?.['custom.series']?.value || product.productType || '--', price: product.price ? `${product.currencyCode || 'PHP'} ${product.price}` : '--', priceValue: product.price ? Number(product.price) : 0, currencyCode: product.currencyCode || 'PHP',
    createdAt: product.shopifyCreatedAt, updatedAt: product.shopifyUpdatedAt, publishedAt: product.publishedAt, arrivalDate: product.publishedAt, isNewArrival: true, isActive: product.isActive, isComingSoon: false,
    image: product.featuredImageUrl || images[0]?.url || null, images: images.map((image) => image.url).filter(Boolean), stockQuantity: product.availableForSale ? 1 : 0, origin: 'Not specified' }
}

function orderBy(sort) {
  if (sort === 'oldest') return { publishedAt: 'asc' }; if (sort === 'name-asc') return { title: 'asc' }; if (sort === 'name-desc') return { title: 'desc' }
  if (sort === 'price-asc') return { price: 'asc' }; if (sort === 'price-desc') return { price: 'desc' }; return { publishedAt: 'desc' }
}

export function productsRoutes({ prisma }) {
  const router = express.Router()
  router.get('/', asyncRoute(async (req, res) => {
    const query = listQuery.parse(req.query)
    const where = { isActive: true, ...(query.category ? { mainCategory: query.category } : {}), ...(query.subcategory ? { subcategory: query.subcategory } : {}), ...(query.inStock ? { availableForSale: query.inStock === 'true' } : {}), ...(query.minPrice !== undefined || query.maxPrice !== undefined ? { price: { ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}), ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}) } } : {}), ...(query.search ? { OR: [...['title', 'description', 'sku', 'productType'].map((field) => ({ [field]: { contains: query.search, mode: 'insensitive' } })), { attributeValues: { some: { value: { contains: query.search, mode: 'insensitive' } } } }] } : {}) }
    const include = { attributeValues: { include: { attribute: true }, orderBy: { attribute: { key: 'asc' } } } }
    const [totalItems, products] = await prisma.$transaction([prisma.product.count({ where }), prisma.product.findMany({ where, include, orderBy: orderBy(query.sort), skip: (query.page - 1) * query.limit, take: query.limit })])
    res.json({ products: products.map(serializeProduct), pagination: { page: query.page, limit: query.limit, totalItems, totalPages: Math.ceil(totalItems / query.limit) } })
  }))
  router.get('/:handle', asyncRoute(async (req, res) => {
    const handle = z.string().min(1).max(255).parse(req.params.handle)
    const product = await prisma.product.findFirst({ where: { handle, isActive: true }, include: { attributeValues: { include: { attribute: true }, orderBy: { attribute: { key: 'asc' } } } } })
    if (!product) throw new HttpError(404, 'Product not found')
    res.json({ product: serializeProduct(product) })
  }))
  return router
}
