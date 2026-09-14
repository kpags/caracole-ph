import express from 'express'
import multer from 'multer'
import { z } from 'zod'
import { asyncRoute, HttpError } from '../lib/http.js'
import { inspectTestimonialMedia, validateTestimonialMediaDetails } from '../lib/testimonial-media.js'

const MAX_TESTIMONIALS = 10
const MAX_MEDIA_SIZE = 500 * 1024 * 1024
const ACCEPTED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'])

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MEDIA_SIZE, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (ACCEPTED_MEDIA_TYPES.has(file.mimetype)) return callback(null, true)
    callback(new HttpError(400, 'Testimonial media must be JPG, PNG, WebP, MP4, or WebM'))
  }
})

const fields = {
  name: z.string().trim().min(1).max(160),
  designation: z.string().trim().min(1).max(120),
  mainTestimony: z.string().trim().min(1).max(150),
  subTestimony: z.string().trim().min(1).max(100),
  position: z.coerce.number().int().min(0).max(MAX_TESTIMONIALS - 1)
}

function serialize(testimonial) {
  return {
    id: testimonial.id,
    name: testimonial.name,
    designation: testimonial.designation,
    mainTestimony: testimonial.mainTestimony,
    subTestimony: testimonial.subTestimony,
    mediaContent: testimonial.mediaContent,
    mediaType: testimonial.mediaType,
    mediaFileName: testimonial.mediaFileName,
    position: testimonial.position,
    createdAt: testimonial.createdAt,
    updatedAt: testimonial.updatedAt
  }
}

async function uploadMedia(storage, file, inspectMedia) {
  const details = await inspectMedia(file)
  validateTestimonialMediaDetails(details)
  const mediaContent = await storage.upload({
    body: file.buffer,
    fileName: file.originalname,
    contentType: file.mimetype,
    prefix: 'testimonials'
  })
  return { mediaContent, mediaType: details.type }
}

export function testimonialsRoutes({ prisma, storage, authenticate, authorize, inspectMedia = inspectTestimonialMedia }) {
  const router = express.Router()

  router.get('/', asyncRoute(async (_req, res) => {
    const testimonials = await prisma.testimonial.findMany({ orderBy: { position: 'asc' } })
    res.json({ testimonials: testimonials.map(serialize) })
  }))

  router.use(authenticate, authorize('staff'))

  router.post('/', mediaUpload.single('media'), asyncRoute(async (req, res) => {
    const body = z.object(fields).strict().parse(req.body)
    if (!req.file) throw new HttpError(400, 'Testimonial media is required')
    const count = await prisma.testimonial.count()
    if (count >= MAX_TESTIMONIALS) throw new HttpError(400, `A maximum of ${MAX_TESTIMONIALS} testimonials is allowed`)
    const occupied = await prisma.testimonial.findUnique({ where: { position: body.position }, select: { id: true } })
    if (occupied) throw new HttpError(409, `Testimonial position ${body.position + 1} is already in use`)
    const uploaded = await uploadMedia(storage, req.file, inspectMedia)
    try {
      const testimonial = await prisma.testimonial.create({ data: { ...body, ...uploaded, mediaFileName: req.file.originalname } })
      res.status(201).json({ testimonial: serialize(testimonial) })
    } catch (error) {
      await storage.delete(uploaded.mediaContent).catch(() => {})
      throw error
    }
  }))

  router.patch('/reorder', asyncRoute(async (req, res) => {
    const { ids } = z.object({ ids: z.array(z.string().uuid()).min(1).max(MAX_TESTIMONIALS) }).strict().parse(req.body)
    if (new Set(ids).size !== ids.length) throw new HttpError(400, 'Testimonial ids must be unique')
    const existing = await prisma.testimonial.findMany({ select: { id: true } })
    if (existing.length !== ids.length || existing.some((item) => !ids.includes(item.id))) throw new HttpError(400, 'Testimonial order must include every saved testimonial')
    await prisma.$transaction([
      prisma.testimonial.updateMany({ data: { position: { increment: MAX_TESTIMONIALS + 1 } } }),
      ...ids.map((id, position) => prisma.testimonial.update({ where: { id }, data: { position } }))
    ])
    const testimonials = await prisma.testimonial.findMany({ orderBy: { position: 'asc' } })
    res.json({ testimonials: testimonials.map(serialize) })
  }))

  router.patch('/:id', mediaUpload.single('media'), asyncRoute(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id)
    const existing = await prisma.testimonial.findUnique({ where: { id } })
    if (!existing) throw new HttpError(404, 'Testimonial not found')
    const body = z.object({
      name: fields.name.optional(), designation: fields.designation.optional(), mainTestimony: fields.mainTestimony.optional(),
      subTestimony: fields.subTestimony.optional(), position: fields.position.optional()
    }).strict().refine((value) => Object.keys(value).length > 0 || Boolean(req.file), 'Provide a testimonial update').parse(req.body)
    if (body.position !== undefined && body.position !== existing.position) {
      const occupied = await prisma.testimonial.findUnique({ where: { position: body.position }, select: { id: true } })
      if (occupied) throw new HttpError(409, `Testimonial position ${body.position + 1} is already in use`)
    }
    const uploaded = req.file ? await uploadMedia(storage, req.file, inspectMedia) : null
    try {
      const testimonial = await prisma.testimonial.update({
        where: { id },
        data: { ...body, ...(uploaded ? { ...uploaded, mediaFileName: req.file.originalname } : {}) }
      })
      if (uploaded) await storage.delete(existing.mediaContent).catch(() => {})
      res.json({ testimonial: serialize(testimonial) })
    } catch (error) {
      if (uploaded) await storage.delete(uploaded.mediaContent).catch(() => {})
      throw error
    }
  }))

  router.delete('/:id', asyncRoute(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id)
    const existing = await prisma.testimonial.findUnique({ where: { id } })
    if (!existing) throw new HttpError(404, 'Testimonial not found')
    await prisma.$transaction([
      prisma.testimonial.delete({ where: { id } }),
      // Move remaining records out of the unique position range first, then
      // close the gap without transient unique-index collisions.
      prisma.testimonial.updateMany({ where: { position: { gt: existing.position } }, data: { position: { increment: MAX_TESTIMONIALS + 1 } } }),
      prisma.testimonial.updateMany({ where: { position: { gt: MAX_TESTIMONIALS } }, data: { position: { decrement: MAX_TESTIMONIALS + 2 } } })
    ])
    await storage.delete(existing.mediaContent).catch(() => {})
    res.status(204).end()
  }))

  return router
}
