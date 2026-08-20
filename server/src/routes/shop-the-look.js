import express from 'express'
import multer from 'multer'
import sanitizeHtml from 'sanitize-html'
import { z } from 'zod'
import { asyncRoute, HttpError } from '../lib/http.js'

const MAX_ENVIRONMENTS = 10
const MAX_HOTSPOTS = 20
const MAX_IMAGE_SIZE = 20 * 1024 * 1024
const DESCRIPTION_MAX_LENGTH = 200

function descriptionText(value) {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, ' ').trim()
}

const descriptionSchema = z.string().trim().min(1).max(50000)
  .refine((value) => !/<\s*(?:a|img)\b/i.test(value), 'Environment descriptions cannot contain links or images')
  .transform((value) => sanitizeHtml(value, {
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'ol', 'ul', 'li', 'blockquote'],
    allowedAttributes: {}
  }))
  .refine((value) => descriptionText(value).length <= DESCRIPTION_MAX_LENGTH, `Environment descriptions cannot exceed ${DESCRIPTION_MAX_LENGTH} characters`)

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) return callback(null, true)
    callback(new HttpError(400, 'Environment images must be JPG, JPEG, or PNG files'))
  }
})

const hotspotSchema = z.object({
  id: z.string().min(1).max(100),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  productId: z.string().uuid().nullable()
}).strict()

const environmentFields = {
  name: z.string().trim().min(1).max(120),
  description: descriptionSchema,
  position: z.coerce.number().int().min(0).max(MAX_ENVIRONMENTS - 1),
  hotspots: z.array(hotspotSchema).max(MAX_HOTSPOTS)
}

function parseHotspots(value) {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    throw new HttpError(400, 'Hotspots must be valid JSON')
  }
}

function serializeEnvironment(environment) {
  return {
    id: environment.id,
    name: environment.name,
    imageUrl: environment.imageUrl,
    imageFileName: environment.imageFileName,
    description: environment.description,
    position: environment.position,
    hotspots: environment.hotspots,
    createdAt: environment.createdAt,
    updatedAt: environment.updatedAt
  }
}

function serializeAssignedProduct(product) {
  const images = Array.isArray(product.images) ? product.images : []
  return {
    id: product.id,
    name: product.title,
    edpNumber: product.sku || '--',
    image: product.featuredImageUrl || images[0]?.url || null
  }
}

function serializePublicEnvironment(environment) {
  return {
    id: environment.id,
    name: environment.name,
    description: environment.description,
    imageUrl: environment.imageUrl,
    position: environment.position,
    hotspots: Array.isArray(environment.hotspots) ? environment.hotspots : []
  }
}

function serializePublicProduct(product) {
  const images = Array.isArray(product.images) ? product.images : []
  return {
    id: product.id,
    handle: product.handle,
    name: product.title,
    edpNumber: product.sku || '--',
    image: product.featuredImageUrl || images[0]?.url || null,
    price: product.price?.toString() || null,
    currencyCode: product.currencyCode || 'PHP',
    category: product.mainCategory || '',
    subcategory: product.subcategory || ''
  }
}

async function validateHotspotProducts(prisma, hotspots) {
  const ids = [...new Set(hotspots.map((hotspot) => hotspot.productId).filter(Boolean))]
  if (!ids.length) return
  const products = await prisma.product.findMany({ where: { id: { in: ids }, isActive: true }, select: { id: true } })
  if (products.length !== ids.length) throw new HttpError(400, 'One or more assigned products are unavailable')
}

export function shopTheLookRoutes({ prisma, storage, authenticate, authorize }) {
  const router = express.Router()

  router.get('/public', asyncRoute(async (_req, res) => {
    const [environments, totalEnvironments] = await prisma.$transaction([
      prisma.shopTheLookEnvironment.findMany({ orderBy: { position: 'asc' }, take: 10 }),
      prisma.shopTheLookEnvironment.count()
    ])
    const assignedProductIds = [...new Set(environments.flatMap((environment) =>
      Array.isArray(environment.hotspots)
        ? environment.hotspots.map((hotspot) => hotspot.productId).filter(Boolean)
        : []
    ))]
    const products = assignedProductIds.length
      ? await prisma.product.findMany({
        where: { id: { in: assignedProductIds }, isActive: true },
        select: {
          id: true, handle: true, title: true, sku: true, featuredImageUrl: true,
          images: true, price: true, currencyCode: true, mainCategory: true, subcategory: true
        }
      })
      : []
    res.json({
      environments: environments.map(serializePublicEnvironment),
      products: products.map(serializePublicProduct),
      totalEnvironments
    })
  }))

  router.use(authenticate, authorize('staff'))

  router.get('/', asyncRoute(async (_req, res) => {
    const environments = await prisma.shopTheLookEnvironment.findMany({ orderBy: { position: 'asc' } })
    const assignedProductIds = [...new Set(environments.flatMap((environment) =>
      Array.isArray(environment.hotspots)
        ? environment.hotspots.map((hotspot) => hotspot.productId).filter(Boolean)
        : []
    ))]
    const products = assignedProductIds.length
      ? await prisma.product.findMany({
        where: { id: { in: assignedProductIds }, isActive: true },
        select: { id: true, title: true, sku: true, featuredImageUrl: true, images: true }
      })
      : []
    res.json({ environments: environments.map(serializeEnvironment), products: products.map(serializeAssignedProduct) })
  }))

  router.post('/', imageUpload.single('image'), asyncRoute(async (req, res) => {
    const body = z.object(environmentFields).strict().parse({ ...req.body, hotspots: parseHotspots(req.body.hotspots) })
    if (!req.file) throw new HttpError(400, 'An environment image is required')
    const count = await prisma.shopTheLookEnvironment.count()
    if (count >= MAX_ENVIRONMENTS) throw new HttpError(400, `A maximum of ${MAX_ENVIRONMENTS} environments is allowed`)
    const occupiedPosition = await prisma.shopTheLookEnvironment.findUnique({ where: { position: body.position }, select: { id: true } })
    if (occupiedPosition) throw new HttpError(409, `Environment slot ${body.position + 1} is already in use`)
    await validateHotspotProducts(prisma, body.hotspots)

    const imageUrl = await storage.upload({
      body: req.file.buffer,
      fileName: req.file.originalname,
      contentType: req.file.mimetype,
      prefix: 'shop_the_look'
    })
    try {
      const environment = await prisma.shopTheLookEnvironment.create({
        data: { ...body, imageUrl, imageFileName: req.file.originalname }
      })
      res.status(201).json({ environment: serializeEnvironment(environment) })
    } catch (error) {
      await storage.delete(imageUrl).catch(() => {})
      throw error
    }
  }))

  router.patch('/:id', imageUpload.single('image'), asyncRoute(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id)
    const existing = await prisma.shopTheLookEnvironment.findUnique({ where: { id } })
    if (!existing) throw new HttpError(404, 'Environment not found')
    const parsed = z.object({
      name: environmentFields.name.optional(),
      description: environmentFields.description.optional(),
      position: environmentFields.position.optional(),
      hotspots: environmentFields.hotspots.optional()
    }).strict().refine((value) => Object.keys(value).length > 0 || Boolean(req.file), 'Provide an environment update')
      .parse({ ...req.body, ...(req.body.hotspots !== undefined ? { hotspots: parseHotspots(req.body.hotspots) } : {}) })
    if (parsed.hotspots) await validateHotspotProducts(prisma, parsed.hotspots)
    if (parsed.position !== undefined && parsed.position !== existing.position) {
      const occupiedPosition = await prisma.shopTheLookEnvironment.findUnique({ where: { position: parsed.position }, select: { id: true } })
      if (occupiedPosition) throw new HttpError(409, `Environment slot ${parsed.position + 1} is already in use`)
    }

    let imageUrl = null
    if (req.file) {
      imageUrl = await storage.upload({
        body: req.file.buffer,
        fileName: req.file.originalname,
        contentType: req.file.mimetype,
        prefix: 'shop_the_look'
      })
    }
    try {
      const environment = await prisma.shopTheLookEnvironment.update({
        where: { id },
        data: { ...parsed, ...(imageUrl ? { imageUrl, imageFileName: req.file.originalname } : {}) }
      })
      if (imageUrl) await storage.delete(existing.imageUrl).catch(() => {})
      res.json({ environment: serializeEnvironment(environment) })
    } catch (error) {
      if (imageUrl) await storage.delete(imageUrl).catch(() => {})
      throw error
    }
  }))

  router.delete('/:id', asyncRoute(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id)
    const existing = await prisma.shopTheLookEnvironment.findUnique({ where: { id } })
    if (!existing) throw new HttpError(404, 'Environment not found')
    await prisma.shopTheLookEnvironment.delete({ where: { id } })
    await storage.delete(existing.imageUrl).catch(() => {})
    res.status(204).end()
  }))

  return router
}
