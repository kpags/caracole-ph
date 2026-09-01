import express from 'express'
import { z } from 'zod'
import { asyncRoute, HttpError } from '../lib/http.js'

const PAGE_SIZE = 10
const ABANDONED_AFTER_DAYS = 7

const cartItemSchema = z.object({
  id: z.string().trim().min(1).max(180),
  handle: z.string().trim().max(255).optional().default(''),
  edpNumber: z.string().trim().max(120).optional().default('--'),
  name: z.string().trim().min(1).max(500),
  image: z.string().trim().url().max(2048).nullable().optional(),
  priceValue: z.coerce.number().min(0).max(100_000_000),
  quantity: z.coerce.number().int().min(1).max(99)
}).strict()

const cartSyncSchema = z.object({
  sessionId: z.string().trim().min(16).max(180),
  customer: z.object({
    email: z.string().trim().toLowerCase().email().max(320),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100)
  }).strict().nullable().optional(),
  items: z.array(cartItemSchema).max(100)
}).strict()

const cartListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(PAGE_SIZE),
  search: z.string().trim().min(1).max(120).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
}).refine(({ dateFrom, dateTo }) => !dateFrom || !dateTo || dateFrom <= dateTo, { message: 'Start date must not be after end date' })

function startOfUtcDay(date) {
  return new Date(`${date}T00:00:00.000Z`)
}

function endOfUtcDay(date) {
  return new Date(`${date}T23:59:59.999Z`)
}

function cartStatus(updatedAt, now = new Date()) {
  const abandonedAt = new Date(now)
  abandonedAt.setUTCDate(abandonedAt.getUTCDate() - ABANDONED_AFTER_DAYS)
  return updatedAt <= abandonedAt ? 'Abandoned' : 'Active'
}

function cartItems(items) {
  return items.map((item) => ({
    id: item.id,
    handle: item.handle,
    edpNumber: item.edpNumber,
    name: item.name,
    image: item.image || null,
    priceValue: item.priceValue,
    quantity: item.quantity,
    totalPrice: Number((item.priceValue * item.quantity).toFixed(2))
  }))
}

export function serializeCart(cart, now = new Date()) {
  return {
    id: cart.id,
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
    sessionId: cart.sessionId,
    email: cart.customerEmail || null,
    firstName: cart.customerFirstName || null,
    lastName: cart.customerLastName || null,
    name: [cart.customerFirstName, cart.customerLastName].filter(Boolean).join(' ') || '--',
    itemCount: cart.itemCount,
    totalPrice: Number(cart.totalPrice),
    currencyCode: cart.currencyCode,
    status: cartStatus(cart.updatedAt, now)
  }
}

function cartListWhere(ownerType, query) {
  const createdAt = {
    ...(query.dateFrom ? { gte: startOfUtcDay(query.dateFrom) } : {}),
    ...(query.dateTo ? { lte: endOfUtcDay(query.dateTo) } : {})
  }
  const search = query.search
    ? ownerType === 'REGISTERED'
      ? { OR: [
        { customerEmail: { contains: query.search, mode: 'insensitive' } },
        { customerFirstName: { contains: query.search, mode: 'insensitive' } },
        { customerLastName: { contains: query.search, mode: 'insensitive' } }
      ] }
      : { sessionId: { contains: query.search, mode: 'insensitive' } }
    : {}
  return { ownerType, itemCount: { gt: 0 }, ...(Object.keys(createdAt).length ? { createdAt } : {}), ...search }
}

export function cartsRoutes({ prisma, authenticate, authorize }) {
  const router = express.Router()

  router.put('/current', asyncRoute(async (req, res) => {
    const body = cartSyncSchema.parse(req.body)
    const customer = body.customer || null
    const ownerType = customer ? 'REGISTERED' : 'SESSION'
    const ownerKey = customer ? `registered:${customer.email}` : `session:${body.sessionId}`
    const items = cartItems(body.items)
    const totalPrice = Number(items.reduce((total, item) => total + item.totalPrice, 0).toFixed(2))
    const cart = await prisma.cart.upsert({
      where: { ownerKey },
      create: {
        ownerKey,
        ownerType,
        sessionId: body.sessionId,
        customerEmail: customer?.email || null,
        customerFirstName: customer?.firstName || null,
        customerLastName: customer?.lastName || null,
        items,
        itemCount: items.length,
        totalPrice
      },
      update: {
        sessionId: body.sessionId,
        customerEmail: customer?.email || null,
        customerFirstName: customer?.firstName || null,
        customerLastName: customer?.lastName || null,
        items,
        itemCount: items.length,
        totalPrice
      }
    })
    res.json({ cart: serializeCart(cart) })
  }))

  router.use(authenticate, authorize('staff'))

  for (const [path, ownerType] of [['/registered', 'REGISTERED'], ['/sessions', 'SESSION']]) {
    router.get(path, asyncRoute(async (req, res) => {
      const query = cartListQuery.parse(req.query)
      const where = cartListWhere(ownerType, query)
      const [totalItems, carts] = await prisma.$transaction([
        prisma.cart.count({ where }),
        prisma.cart.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit })
      ])
      res.json({ carts: carts.map((cart) => serializeCart(cart)), pagination: { page: query.page, limit: query.limit, totalItems, totalPages: Math.ceil(totalItems / query.limit) } })
    }))
  }

  router.get('/:id', asyncRoute(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id)
    const cart = await prisma.cart.findUnique({ where: { id } })
    if (!cart || cart.itemCount < 1) throw new HttpError(404, 'Cart not found')
    res.json({ cart: { ...serializeCart(cart), items: cartItems(Array.isArray(cart.items) ? cart.items : []) } })
  }))

  return router
}

export { ABANDONED_AFTER_DAYS, cartStatus, cartItems, cartListWhere }
