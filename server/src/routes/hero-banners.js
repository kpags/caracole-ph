import express from 'express'
import multer from 'multer'
import { z } from 'zod'
import { asyncRoute, HttpError } from '../lib/http.js'
import { heroBannerCreateSchema, heroBannerUpdateSchema } from '../lib/validation.js'

const MAX_HERO_BANNERS = 3
const MAX_MEDIA_SIZE = 500 * 1024 * 1024

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MEDIA_SIZE, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) return callback(null, true)
    callback(new HttpError(400, 'Hero banner media must be an image or video'))
  }
})

function serializeHeroBanner(banner) {
  return {
    id: banner.id,
    createdAt: banner.createdAt,
    updatedAt: banner.updatedAt,
    title: banner.title,
    subtitle: banner.subtitle || '',
    description: banner.description,
    category: banner.category,
    mediaUrl: banner.mediaUrl,
    mediaType: banner.mediaType,
    position: banner.position
  }
}

function fileMediaType(file) {
  return file.mimetype.startsWith('video/') ? 'video' : 'image'
}

export function heroBannersRoutes({ prisma, storage, authenticate, authorize }) {
  const router = express.Router()

  router.get('/', asyncRoute(async (_req, res) => {
    const heroBanners = await prisma.heroBanner.findMany({ orderBy: { position: 'asc' } })
    res.json({ heroBanners: heroBanners.map(serializeHeroBanner) })
  }))

  router.post('/', authenticate, authorize('staff'), mediaUpload.single('media'), asyncRoute(async (req, res) => {
    const body = heroBannerCreateSchema.parse(req.body)
    if (!req.file) throw new HttpError(400, 'Hero banner media is required')

    const count = await prisma.heroBanner.count()
    if (count >= MAX_HERO_BANNERS) throw new HttpError(400, `A maximum of ${MAX_HERO_BANNERS} hero banners is allowed`)
    const existingAtPosition = await prisma.heroBanner.findUnique({ where: { position: body.position }, select: { id: true } })
    if (existingAtPosition) throw new HttpError(409, `Hero banner position ${body.position + 1} is already in use`)

    const mediaUrl = await storage.upload({
      body: req.file.buffer,
      fileName: req.file.originalname,
      contentType: req.file.mimetype,
      prefix: 'hero_banners'
    })

    try {
      const heroBanner = await prisma.heroBanner.create({
        data: { ...body, mediaUrl, mediaType: fileMediaType(req.file) }
      })
      res.status(201).json({ heroBanner: serializeHeroBanner(heroBanner) })
    } catch (error) {
      await storage.delete(mediaUrl).catch(() => {})
      throw error
    }
  }))

  router.patch('/reorder', authenticate, authorize('staff'), asyncRoute(async (req, res) => {
    const { ids } = z.object({ ids: z.array(z.string().uuid()).min(1).max(MAX_HERO_BANNERS) }).strict().parse(req.body)
    if (new Set(ids).size !== ids.length) throw new HttpError(400, 'Hero banner ids must be unique')

    const heroBanners = await prisma.heroBanner.findMany({ select: { id: true } })
    if (heroBanners.length !== ids.length || heroBanners.some((banner) => !ids.includes(banner.id))) {
      throw new HttpError(400, 'Hero banner order must include every existing banner')
    }

    await prisma.$transaction([
      prisma.heroBanner.updateMany({ data: { position: { increment: MAX_HERO_BANNERS + 1 } } }),
      ...ids.map((id, position) => prisma.heroBanner.update({ where: { id }, data: { position } }))
    ])
    const orderedHeroBanners = await prisma.heroBanner.findMany({ orderBy: { position: 'asc' } })
    res.json({ heroBanners: orderedHeroBanners.map(serializeHeroBanner) })
  }))

  router.patch('/:id', authenticate, authorize('staff'), mediaUpload.single('media'), asyncRoute(async (req, res) => {
    const body = heroBannerUpdateSchema.parse(req.body)
    const id = z.string().uuid().parse(req.params.id)
    const existing = await prisma.heroBanner.findUnique({ where: { id } })
    if (!existing) throw new HttpError(404, 'Hero banner not found')
    const replacementPosition = body.position
    const bannerAtReplacementPosition = replacementPosition === undefined || replacementPosition === existing.position
      ? null
      : await prisma.heroBanner.findUnique({ where: { position: replacementPosition } })

    let uploadedMediaUrl = null
    if (req.file) {
      uploadedMediaUrl = await storage.upload({
        body: req.file.buffer,
        fileName: req.file.originalname,
        contentType: req.file.mimetype,
        prefix: 'hero_banners'
      })
    }

    try {
      const updateData = {
        ...body,
        ...(uploadedMediaUrl ? { mediaUrl: uploadedMediaUrl, mediaType: fileMediaType(req.file) } : {})
      }
      const heroBanner = bannerAtReplacementPosition
        ? (await prisma.$transaction([
            prisma.heroBanner.update({ where: { id: existing.id }, data: { position: existing.position + MAX_HERO_BANNERS } }),
            prisma.heroBanner.update({ where: { id: bannerAtReplacementPosition.id }, data: { position: existing.position } }),
            prisma.heroBanner.update({ where: { id: existing.id }, data: updateData })
          ]))[2]
        : await prisma.heroBanner.update({ where: { id: existing.id }, data: updateData })
      if (uploadedMediaUrl) await storage.delete(existing.mediaUrl).catch((error) => console.error('Unable to remove replaced hero banner media', error))
      res.json({ heroBanner: serializeHeroBanner(heroBanner) })
    } catch (error) {
      if (uploadedMediaUrl) await storage.delete(uploadedMediaUrl).catch(() => {})
      throw error
    }
  }))

  router.delete('/:id', authenticate, authorize('staff'), asyncRoute(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id)
    const existing = await prisma.heroBanner.findUnique({ where: { id } })
    if (!existing) throw new HttpError(404, 'Hero banner not found')

    await prisma.heroBanner.delete({ where: { id } })
    await storage.delete(existing.mediaUrl).catch((error) =>
      console.error('Unable to remove deleted hero banner media', error)
    )
    res.status(204).end()
  }))

  return router
}
