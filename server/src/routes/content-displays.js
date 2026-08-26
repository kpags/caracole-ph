import express from 'express'
import multer from 'multer'
import { z } from 'zod'
import { asyncRoute, HttpError } from '../lib/http.js'

const MAIN_CATEGORIES = ['Living', 'Dining', 'Bedroom', 'Mirrors & Accessories', 'Entertainment']
const MAX_FEATURED_DESIGNERS = 2
const MAX_FEATURED_PRODUCTS = 5
const MAX_IMAGE_SIZE = 20 * 1024 * 1024

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: MAX_FEATURED_PRODUCTS + 2 },
  fileFilter: (_req, file, callback) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return callback(null, true)
    callback(new HttpError(400, 'Images must be JPG, PNG, or WebP files'))
  }
})

const featuredProductSchema = z.object({
  name: z.string().trim().min(1).max(160),
  shortDescription: z.string().trim().min(1).max(150),
  lifestyleImageUrl: z.string().url().optional()
}).strict()

const designerFieldsSchema = z.object({
  name: z.string().trim().min(1).max(160),
  link: z.union([z.string().trim().url(), z.literal('')]).optional(),
  tagline: z.string().trim().min(1).max(100),
  briefStory: z.string().trim().min(1).max(300),
  isFeatured: z.boolean(),
  featuredProducts: z.array(featuredProductSchema).max(MAX_FEATURED_PRODUCTS)
}).strict()

function parseBoolean(value, fallback = false) {
  if (value === undefined) return fallback
  if (value === true || value === 'true') return true
  if (value === false || value === 'false') return false
  throw new HttpError(400, 'Featured must be true or false')
}

function parseFeaturedProducts(value, fallback) {
  if (value === undefined) return fallback
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    throw new HttpError(400, 'Featured products must be valid JSON')
  }
}

function parseDesignerFields(body, { partial = false, fallbackProducts = [] } = {}) {
  const value = {
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.link !== undefined ? { link: body.link.trim() } : {}),
    ...(body.tagline !== undefined ? { tagline: body.tagline } : {}),
    ...(body.briefStory !== undefined ? { briefStory: body.briefStory } : {}),
    ...(body.isFeatured !== undefined ? { isFeatured: parseBoolean(body.isFeatured) } : {}),
    ...(body.featuredProducts !== undefined ? { featuredProducts: parseFeaturedProducts(body.featuredProducts, fallbackProducts) } : {})
  }
  if (partial) {
    const parsed = designerFieldsSchema.partial().parse(value)
    if (!Object.keys(parsed).length) throw new HttpError(400, 'Provide designer content to update')
    return parsed
  }
  return designerFieldsSchema.parse({ ...value, isFeatured: value.isFeatured ?? false, featuredProducts: value.featuredProducts ?? [] })
}

function collectFiles(files = []) {
  const result = { thumbnailImage: null, headerImage: null, lifestyleImages: new Map() }
  for (const file of files) {
    if (file.fieldname === 'thumbnailImage' || file.fieldname === 'headerImage') {
      if (result[file.fieldname]) throw new HttpError(400, `${file.fieldname} may be supplied once`)
      result[file.fieldname] = file
      continue
    }
    const match = /^lifestyleImage([0-4])$/.exec(file.fieldname)
    if (!match || result.lifestyleImages.has(Number(match[1]))) throw new HttpError(400, 'Invalid featured product image field')
    result.lifestyleImages.set(Number(match[1]), file)
  }
  return result
}

function slugify(value) {
  return value.toLowerCase().trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 160) || 'designer'
}

async function createUniqueSlug(prisma, name) {
  const base = slugify(name)
  let slug = base
  let suffix = 2
  while (await prisma.designerProfile.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${suffix++}`
  }
  return slug
}

function serializeDesigner(designer) {
  return {
    id: designer.id,
    createdAt: designer.createdAt,
    updatedAt: designer.updatedAt,
    slug: designer.slug,
    name: designer.name,
    link: designer.link,
    tagline: designer.tagline,
    briefStory: designer.briefStory,
    thumbnailImageUrl: designer.thumbnailImageUrl,
    headerImageUrl: designer.headerImageUrl,
    isFeatured: designer.isFeatured,
    featuredProducts: (designer.featuredProducts || []).sort((a, b) => a.position - b.position).map((product) => ({
      id: product.id,
      name: product.name,
      shortDescription: product.shortDescription,
      lifestyleImageUrl: product.lifestyleImageUrl,
      position: product.position
    }))
  }
}

async function ensureFeaturedCapacity(prisma, isFeatured, excludeId) {
  if (!isFeatured) return
  const count = await prisma.designerProfile.count({ where: { isFeatured: true, ...(excludeId ? { id: { not: excludeId } } : {}) } })
  if (count >= MAX_FEATURED_DESIGNERS) throw new HttpError(400, `A maximum of ${MAX_FEATURED_DESIGNERS} featured designers is allowed`)
}

async function uploadImage(storage, file) {
  return storage.upload({
    body: file.buffer,
    fileName: file.originalname,
    contentType: file.mimetype,
    prefix: 'designers'
  })
}

async function uploadDesignerImages(storage, files) {
  const uploaded = []
  try {
    const thumbnailImageUrl = files.thumbnailImage ? await uploadImage(storage, files.thumbnailImage) : null
    if (thumbnailImageUrl) uploaded.push(thumbnailImageUrl)
    const headerImageUrl = files.headerImage ? await uploadImage(storage, files.headerImage) : null
    if (headerImageUrl) uploaded.push(headerImageUrl)
    const lifestyleImageUrls = new Map()
    for (const [index, file] of files.lifestyleImages) {
      const imageUrl = await uploadImage(storage, file)
      uploaded.push(imageUrl)
      lifestyleImageUrls.set(index, imageUrl)
    }
    return { thumbnailImageUrl, headerImageUrl, lifestyleImageUrls, uploaded }
  } catch (error) {
    await Promise.all(uploaded.map((url) => storage.delete(url).catch(() => {})))
    throw error
  }
}

function requiredLifestyleUrls(products, uploadedUrls, existingUrls = new Set()) {
  return products.map((product, index) => {
    const lifestyleImageUrl = uploadedUrls.get(index) || product.lifestyleImageUrl
    if (!lifestyleImageUrl || (!uploadedUrls.has(index) && !existingUrls.has(lifestyleImageUrl))) {
      throw new HttpError(400, `A lifestyle image is required for featured product ${index + 1}`)
    }
    return { ...product, lifestyleImageUrl, position: index }
  })
}

export function contentDisplaysRoutes({ prisma, storage, authenticate, authorize }) {
  const router = express.Router()

  router.get('/main-categories', asyncRoute(async (_req, res) => {
    const displays = await prisma.mainCategoryDisplay.findMany({ orderBy: { name: 'asc' } })
    res.json({ displays: displays.map((display) => ({ name: display.name, imageUrl: display.imageUrl, updatedAt: display.updatedAt })) })
  }))

  router.get('/designers/public', asyncRoute(async (_req, res) => {
    const designers = await prisma.designerProfile.findMany({ include: { featuredProducts: true }, orderBy: [{ isFeatured: 'desc' }, { createdAt: 'asc' }] })
    res.json({ designers: designers.map(serializeDesigner) })
  }))

  router.use(authenticate, authorize('staff'))

  router.put('/main-categories/:name', imageUpload.single('image'), asyncRoute(async (req, res) => {
    const name = z.enum(MAIN_CATEGORIES).parse(req.params.name)
    if (!req.file) throw new HttpError(400, 'A main category image is required')
    const existing = await prisma.mainCategoryDisplay.findUnique({ where: { name } })
    const imageUrl = await storage.upload({ body: req.file.buffer, fileName: req.file.originalname, contentType: req.file.mimetype, prefix: 'main_categories' })
    try {
      const display = await prisma.mainCategoryDisplay.upsert({
        where: { name },
        create: { name, imageUrl },
        update: { imageUrl }
      })
      if (existing) await storage.delete(existing.imageUrl).catch(() => {})
      res.json({ display: { name: display.name, imageUrl: display.imageUrl, updatedAt: display.updatedAt } })
    } catch (error) {
      await storage.delete(imageUrl).catch(() => {})
      throw error
    }
  }))

  router.delete('/main-categories/:name', asyncRoute(async (req, res) => {
    const name = z.enum(MAIN_CATEGORIES).parse(req.params.name)
    const existing = await prisma.mainCategoryDisplay.findUnique({ where: { name } })
    if (!existing) throw new HttpError(404, 'No custom image has been uploaded for this category')
    await prisma.mainCategoryDisplay.delete({ where: { name } })
    await storage.delete(existing.imageUrl).catch(() => {})
    res.status(204).end()
  }))

  router.get('/designers', asyncRoute(async (_req, res) => {
    const designers = await prisma.designerProfile.findMany({ include: { featuredProducts: true }, orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }] })
    res.json({ designers: designers.map(serializeDesigner) })
  }))

  router.post('/designers', imageUpload.any(), asyncRoute(async (req, res) => {
    const body = parseDesignerFields(req.body)
    const files = collectFiles(req.files)
    if (!files.thumbnailImage || !files.headerImage) throw new HttpError(400, 'Thumbnail and header images are required')
    await ensureFeaturedCapacity(prisma, body.isFeatured)
    const uploaded = await uploadDesignerImages(storage, files)
    try {
      const featuredProducts = requiredLifestyleUrls(body.featuredProducts, uploaded.lifestyleImageUrls)
      const designer = await prisma.designerProfile.create({
        data: {
          slug: await createUniqueSlug(prisma, body.name),
          name: body.name,
          ...(body.link !== undefined ? { link: body.link || null } : {}),
          tagline: body.tagline,
          briefStory: body.briefStory,
          isFeatured: body.isFeatured,
          thumbnailImageUrl: uploaded.thumbnailImageUrl,
          headerImageUrl: uploaded.headerImageUrl,
          featuredProducts: { create: featuredProducts }
        },
        include: { featuredProducts: true }
      })
      res.status(201).json({ designer: serializeDesigner(designer) })
    } catch (error) {
      await Promise.all(uploaded.uploaded.map((url) => storage.delete(url).catch(() => {})))
      throw error
    }
  }))

  router.patch('/designers/:id', imageUpload.any(), asyncRoute(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id)
    const existing = await prisma.designerProfile.findUnique({ where: { id }, include: { featuredProducts: true } })
    if (!existing) throw new HttpError(404, 'Designer profile not found')
    const body = parseDesignerFields(req.body, { partial: true })
    const files = collectFiles(req.files)
    if (body.featuredProducts === undefined && files.lifestyleImages.size) {
      throw new HttpError(400, 'Provide featured product details with any lifestyle image')
    }
    if (body.isFeatured !== undefined) await ensureFeaturedCapacity(prisma, body.isFeatured, id)
    const uploaded = await uploadDesignerImages(storage, files)
    const existingProductUrls = new Set(existing.featuredProducts.map((product) => product.lifestyleImageUrl))
    let featuredProducts
    try {
      featuredProducts = body.featuredProducts === undefined
        ? null
        : requiredLifestyleUrls(body.featuredProducts, uploaded.lifestyleImageUrls, existingProductUrls)
      const designer = await prisma.designerProfile.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.link !== undefined ? { link: body.link || null } : {}),
          ...(body.tagline !== undefined ? { tagline: body.tagline } : {}),
          ...(body.briefStory !== undefined ? { briefStory: body.briefStory } : {}),
          ...(body.isFeatured !== undefined ? { isFeatured: body.isFeatured } : {}),
          ...(uploaded.thumbnailImageUrl ? { thumbnailImageUrl: uploaded.thumbnailImageUrl } : {}),
          ...(uploaded.headerImageUrl ? { headerImageUrl: uploaded.headerImageUrl } : {}),
          ...(featuredProducts ? { featuredProducts: { deleteMany: {}, create: featuredProducts } } : {})
        },
        include: { featuredProducts: true }
      })
      const retainedUrls = new Set(designer.featuredProducts.map((product) => product.lifestyleImageUrl))
      const removedUrls = [
        ...(uploaded.thumbnailImageUrl ? [existing.thumbnailImageUrl] : []),
        ...(uploaded.headerImageUrl ? [existing.headerImageUrl] : []),
        ...(featuredProducts ? existing.featuredProducts.map((product) => product.lifestyleImageUrl).filter((url) => !retainedUrls.has(url)) : [])
      ]
      await Promise.all(removedUrls.map((url) => storage.delete(url).catch(() => {})))
      res.json({ designer: serializeDesigner(designer) })
    } catch (error) {
      await Promise.all(uploaded.uploaded.map((url) => storage.delete(url).catch(() => {})))
      throw error
    }
  }))

  router.delete('/designers/:id', asyncRoute(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id)
    const existing = await prisma.designerProfile.findUnique({ where: { id }, include: { featuredProducts: true } })
    if (!existing) throw new HttpError(404, 'Designer profile not found')
    await prisma.designerProfile.delete({ where: { id } })
    await Promise.all([existing.thumbnailImageUrl, existing.headerImageUrl, ...existing.featuredProducts.map((product) => product.lifestyleImageUrl)].map((url) => storage.delete(url).catch(() => {})))
    res.status(204).end()
  }))

  return router
}
