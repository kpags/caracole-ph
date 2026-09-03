import express from 'express'
import multer from 'multer'
import path from 'node:path'
import { z } from 'zod'
import { asyncRoute, HttpError } from '../lib/http.js'

const MAX_IMAGES = 3
const MAX_CONTACT_NUMBERS = 2
const MAX_IMAGE_SIZE = 20 * 1024 * 1024
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: MAX_IMAGES },
  fileFilter: (_req, file, callback) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return callback(null, true)
    callback(new HttpError(400, 'Showroom images must be JPG, PNG, or WebP files'))
  }
}).fields([0, 1, 2].map((position) => ({ name: `image${position}`, maxCount: 1 })))

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Times must use the HH:MM format')
const scheduleSchema = z.object({
  dayStart: z.coerce.number().int().min(0).max(6),
  dayEnd: z.coerce.number().int().min(0).max(6),
  timeOpen: timeSchema,
  timeClose: timeSchema
}).strict().refine((value) => value.dayEnd >= value.dayStart, 'The ending day must not precede the starting day')

const branchFieldsSchema = z.object({
  name: z.string().trim().min(1).max(160),
  address: z.string().trim().min(1).max(500),
  contactNumbers: z.array(z.string().trim().min(1).max(60)).min(1).max(MAX_CONTACT_NUMBERS),
  schedules: z.array(scheduleSchema).min(1).max(14)
}).strict()

function slugify(value) {
  return value.toLowerCase().trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 160) || 'showroom'
}

function parseJson(value, label) {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    throw new HttpError(400, `${label} must be valid JSON`)
  }
}

function parseBranchFields(body, { partial = false } = {}) {
  const value = {
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.address !== undefined ? { address: body.address } : {}),
    ...(body.contactNumbers !== undefined ? { contactNumbers: parseJson(body.contactNumbers, 'Contact numbers') } : {}),
    ...(body.schedules !== undefined ? { schedules: parseJson(body.schedules, 'Schedules') } : {})
  }
  const schema = partial ? branchFieldsSchema.partial() : branchFieldsSchema
  return schema.parse(value)
}

function parseClearPositions(value) {
  if (value === undefined) return []
  const positions = z.array(z.coerce.number().int().min(0).max(MAX_IMAGES - 1)).parse(parseJson(value, 'Cleared image positions'))
  if (new Set(positions).size !== positions.length) throw new HttpError(400, 'Cleared image positions must be unique')
  return positions
}

function filesByPosition(files) {
  return new Map([0, 1, 2].flatMap((position) => {
    const file = files?.[`image${position}`]?.[0]
    return file ? [[position, file]] : []
  }))
}

function serializeBranch(branch) {
  return {
    id: branch.id,
    name: branch.name,
    address: branch.address,
    contactNumbers: branch.contactNumbers || [],
    position: branch.position,
    images: (branch.images || []).sort((left, right) => left.position - right.position).map((image) => ({
      id: image.id,
      imageUrl: image.imageUrl,
      position: image.position
    })),
    schedules: (branch.schedules || []).sort((left, right) => left.position - right.position).map((schedule) => ({
      id: schedule.id,
      dayStart: schedule.dayStart,
      dayEnd: schedule.dayEnd,
      timeOpen: schedule.timeOpen,
      timeClose: schedule.timeClose,
      dayStartLabel: WEEKDAYS[schedule.dayStart],
      dayEndLabel: WEEKDAYS[schedule.dayEnd]
    })),
    createdAt: branch.createdAt,
    updatedAt: branch.updatedAt
  }
}

const branchInclude = { images: true, schedules: true }

async function uniqueSlug(prisma, name, excludeId) {
  const base = slugify(name)
  let slug = base
  let suffix = 2
  while (true) {
    const existing = await prisma.showroomBranch.findUnique({ where: { slug }, select: { id: true } })
    if (!existing || existing.id === excludeId) return slug
    slug = `${base}-${suffix++}`
  }
}

async function uploadFiles(storage, files, slug) {
  const uploaded = new Map()
  try {
    for (const [position, file] of files) {
      const imageUrl = await storage.upload({
        body: file.buffer,
        fileName: file.originalname,
        contentType: file.mimetype,
        prefix: `showrooms/${slug}`
      })
      uploaded.set(position, imageUrl)
    }
    return uploaded
  } catch (error) {
    await Promise.all([...uploaded.values()].map((url) => storage.delete(url).catch(() => {})))
    throw error
  }
}

function scheduleCreateData(schedules) {
  return schedules.map((schedule, position) => ({ ...schedule, position }))
}

function imageDestinationKey(storage, imageUrl, slug) {
  const sourceKey = storage.resolveObjectKey(imageUrl)
  return `showrooms/${slug}/${path.posix.basename(sourceKey)}`
}

export function showroomsRoutes({ prisma, storage, authenticate, authorize }) {
  const router = express.Router()

  router.get('/public', asyncRoute(async (_req, res) => {
    const branches = await prisma.showroomBranch.findMany({ orderBy: { position: 'asc' }, include: branchInclude })
    res.json({ branches: branches.map(serializeBranch) })
  }))

  router.use(authenticate, authorize('staff'))

  router.get('/', asyncRoute(async (_req, res) => {
    const branches = await prisma.showroomBranch.findMany({ orderBy: { position: 'asc' }, include: branchInclude })
    res.json({ branches: branches.map(serializeBranch) })
  }))

  router.post('/', imageUpload, asyncRoute(async (req, res) => {
    const fields = parseBranchFields(req.body)
    const files = filesByPosition(req.files)
    if (!files.size) throw new HttpError(400, 'At least one showroom image is required')
    const duplicate = await prisma.showroomBranch.findUnique({ where: { name: fields.name }, select: { id: true } })
    if (duplicate) throw new HttpError(409, 'A showroom with this name already exists')
    const slug = await uniqueSlug(prisma, fields.name)
    const lastBranch = await prisma.showroomBranch.findFirst({ orderBy: { position: 'desc' }, select: { position: true } })
    const uploaded = await uploadFiles(storage, files, slug)
    try {
      const branch = await prisma.showroomBranch.create({
        data: {
          ...fields,
          slug,
          position: (lastBranch?.position ?? -1) + 1,
          images: { create: [...uploaded.entries()].map(([position, imageUrl]) => ({ position, imageUrl })) },
          schedules: { create: scheduleCreateData(fields.schedules) }
        },
        include: branchInclude
      })
      res.status(201).json({ branch: serializeBranch(branch) })
    } catch (error) {
      await Promise.all([...uploaded.values()].map((url) => storage.delete(url).catch(() => {})))
      throw error
    }
  }))

  router.patch('/:id', imageUpload, asyncRoute(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id)
    const existing = await prisma.showroomBranch.findUnique({ where: { id }, include: branchInclude })
    if (!existing) throw new HttpError(404, 'Showroom branch not found')
    const fields = parseBranchFields(req.body, { partial: true })
    const files = filesByPosition(req.files)
    const clearedPositions = parseClearPositions(req.body.clearImagePositions)
    if (!Object.keys(fields).length && !files.size && !clearedPositions.length) {
      throw new HttpError(400, 'Provide showroom details or images to update')
    }
    const replacementPositions = new Set([...files.keys()])
    const removedPositions = new Set([...clearedPositions, ...replacementPositions])
    const existingByPosition = new Map(existing.images.map((image) => [image.position, image]))
    const retained = existing.images.filter((image) => !removedPositions.has(image.position))
    if (retained.length + files.size < 1) throw new HttpError(400, 'A showroom must keep at least one image')
    if (retained.length + files.size > MAX_IMAGES) throw new HttpError(400, `A maximum of ${MAX_IMAGES} showroom images is allowed`)

    if (fields.name && fields.name !== existing.name) {
      const duplicate = await prisma.showroomBranch.findUnique({ where: { name: fields.name }, select: { id: true } })
      if (duplicate && duplicate.id !== id) throw new HttpError(409, 'A showroom with this name already exists')
    }
    const slug = fields.name ? await uniqueSlug(prisma, fields.name, id) : existing.slug
    const uploaded = await uploadFiles(storage, files, slug)
    const renamed = new Map()
    try {
      if (slug !== existing.slug) {
        for (const image of retained) {
          const imageUrl = await storage.rename(image.imageUrl, imageDestinationKey(storage, image.imageUrl, slug))
          renamed.set(image.id, imageUrl)
        }
      }
      const branch = await prisma.$transaction(async (tx) => {
        if (removedPositions.size) {
          await tx.showroomImage.deleteMany({ where: { branchId: id, position: { in: [...removedPositions] } } })
        }
        if (uploaded.size) {
          await tx.showroomImage.createMany({ data: [...uploaded.entries()].map(([position, imageUrl]) => ({ branchId: id, position, imageUrl })) })
        }
        for (const [imageId, imageUrl] of renamed) await tx.showroomImage.update({ where: { id: imageId }, data: { imageUrl } })
        return tx.showroomBranch.update({
          where: { id },
          data: {
            ...(fields.name ? { name: fields.name, slug } : {}),
            ...(fields.address ? { address: fields.address } : {}),
            ...(fields.contactNumbers ? { contactNumbers: fields.contactNumbers } : {}),
            ...(fields.schedules ? { schedules: { deleteMany: {}, create: scheduleCreateData(fields.schedules) } } : {})
          },
          include: branchInclude
        })
      })
      const obsoleteUrls = existing.images.filter((image) => removedPositions.has(image.position)).map((image) => image.imageUrl)
      await Promise.all(obsoleteUrls.map((url) => storage.delete(url).catch((error) => console.error('Unable to remove replaced showroom image', error))))
      res.json({ branch: serializeBranch(branch) })
    } catch (error) {
      await Promise.all([...uploaded.values()].map((url) => storage.delete(url).catch(() => {})))
      throw error
    }
  }))

  router.delete('/:id', asyncRoute(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id)
    const existing = await prisma.showroomBranch.findUnique({ where: { id }, include: { images: true } })
    if (!existing) throw new HttpError(404, 'Showroom branch not found')
    await prisma.showroomBranch.delete({ where: { id } })
    await Promise.all(existing.images.map((image) => storage.delete(image.imageUrl).catch((error) => console.error('Unable to remove showroom image', error))))
    res.status(204).end()
  }))

  return router
}
