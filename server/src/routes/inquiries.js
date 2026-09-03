import express from 'express'
import { z } from 'zod'
import { asyncRoute, HttpError } from '../lib/http.js'
import { emailSchema } from '../lib/validation.js'

export const inquirySubmissionSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: emailSchema,
  contactNumber: z.string().trim().min(1).max(60),
  inquiry: z.string().trim().min(1).max(10_000),
  productName: z.string().trim().min(1).max(255).optional(),
  edpNumber: z.string().trim().min(1).max(120).optional(),
  articleNumber: z.string().trim().min(1).max(120).optional()
}).strict()

export const inquiryListQuery = z.object({
  type: z.enum(['general', 'product']).default('general'),
  search: z.string().trim().min(1).max(120).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10)
}).refine(({ dateFrom, dateTo }) => !dateFrom || !dateTo || dateFrom <= dateTo, { message: 'Start date must not be after end date' })

export function configuredEmailRecipients(value) {
  return [...new Set(String(value || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => z.string().email().safeParse(email).success))]
}

export function inquiryRecipients(config) {
  return configuredEmailRecipients(config.INQUIRY_RECEIVERS)
}

export function serializeInquiry(inquiry) {
  return {
    id: inquiry.id,
    createdAt: inquiry.createdAt,
    firstName: inquiry.firstName,
    lastName: inquiry.lastName,
    email: inquiry.email,
    contactNumber: inquiry.contactNumber,
    inquiry: inquiry.message,
    productName: inquiry.productName,
    edpNumber: inquiry.edpNumber,
    articleNumber: inquiry.articleNumber,
    status: inquiry.status
  }
}

function startOfUtcDay(date) {
  return new Date(`${date}T00:00:00.000Z`)
}

function endOfUtcDay(date) {
  return new Date(`${date}T23:59:59.999Z`)
}

export function inquiryListWhere(query) {
  const createdAt = {
    ...(query.dateFrom ? { gte: startOfUtcDay(query.dateFrom) } : {}),
    ...(query.dateTo ? { lte: endOfUtcDay(query.dateTo) } : {})
  }
  const searchableFields = ['email', 'firstName', 'lastName', 'contactNumber']
  if (query.type === 'product') searchableFields.push('productName', 'edpNumber', 'articleNumber')
  return {
    ...(query.type === 'product' ? { productName: { not: null } } : { productName: null }),
    ...(Object.keys(createdAt).length ? { createdAt } : {}),
    ...(query.search ? { OR: searchableFields.map((field) => ({ [field]: { contains: query.search, mode: 'insensitive' } })) } : {})
  }
}

export function inquiriesRoutes({ prisma, config, mailer, authenticate, authorize }) {
  const router = express.Router()

  router.post('/', asyncRoute(async (req, res) => {
    const body = inquirySubmissionSchema.parse(req.body)
    const inquiry = await prisma.inquiry.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        contactNumber: body.contactNumber,
        message: body.inquiry,
        productName: body.productName || null,
        edpNumber: body.edpNumber || null,
        articleNumber: body.articleNumber || null
      }
    })

    await Promise.all([
      mailer.sendInquiryConfirmation({ inquiry, config }),
      mailer.sendInquiryNotification({ inquiry, recipients: inquiryRecipients(config), config })
    ])

    res.status(201).json({
      message: 'Thank you. Your inquiry has been received by the Caracole PH team.',
      inquiry: serializeInquiry(inquiry)
    })
  }))

  router.get('/', authenticate, authorize('staff'), asyncRoute(async (req, res) => {
    const query = inquiryListQuery.parse(req.query)
    const where = inquiryListWhere(query)
    const [totalItems, inquiries] = await prisma.$transaction([
      prisma.inquiry.count({ where }),
      prisma.inquiry.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit })
    ])
    res.json({ inquiries: inquiries.map(serializeInquiry), pagination: { page: query.page, limit: query.limit, totalItems, totalPages: Math.ceil(totalItems / query.limit) } })
  }))

  router.get('/:id', authenticate, authorize('staff'), asyncRoute(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id)
    const inquiry = await prisma.inquiry.findUnique({ where: { id } })
    if (!inquiry) throw new HttpError(404, 'Inquiry not found')
    res.json({ inquiry: serializeInquiry(inquiry) })
  }))

  return router
}
