import crypto from 'node:crypto'
import express from 'express'
import { z } from 'zod'
import { asyncRoute, HttpError } from '../lib/http.js'
import { createPaymongoClient, PAYMONGO_PAYMENT_METHOD_TYPES, PAYMONGO_WEBHOOK_EVENTS } from '../lib/paymongo.js'
import { createPaymentAccessToken, decryptPaymentSecret, encryptPaymentSecret, hashPaymentAccessToken, paymentSecretFingerprint, verifyPaymongoSignature } from '../lib/payment-crypto.js'

const PAGE_SIZE = 10
const PAYMONGO = 'PAYMONGO'
const TEST = 'TEST'
const LIVE = 'LIVE'
const baseUrl = 'https://api.paymongo.com'

const credentialSchema = z.object({
  publicKey: z.string().trim().min(8).max(500).optional(),
  secretKey: z.string().trim().min(12).max(1000).optional(),
  sendEmailReceipt: z.boolean().optional()
}).strict()

const gatewaySchema = z.object({
  useTestMode: z.boolean().default(true),
  isEnabled: z.boolean().default(true),
  test: credentialSchema.optional(),
  live: credentialSchema.optional()
}).strict()

const webhookSchema = z.object({
  mode: z.enum([TEST, LIVE]),
  eventType: z.enum(PAYMONGO_WEBHOOK_EVENTS),
  url: z.string().trim().url().max(2048).optional()
}).strict()

const credentialTestSchema = z.object({
  mode: z.enum([TEST, LIVE]),
  gatewayId: z.string().uuid().optional(),
  secretKey: z.string().trim().min(12).max(1000).optional()
}).strict()

const checkoutSchema = z.object({
  items: z.array(z.object({ id: z.string().trim().min(1).max(300), quantity: z.coerce.number().int().min(1).max(99) }).strict()).min(1).max(100),
  checkout: z.object({
    customer: z.object({
      firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().min(1).max(100), email: z.string().trim().toLowerCase().email().max(320), phone: z.string().trim().min(1).max(60),
      address: z.string().trim().min(1).max(300), apartment: z.string().trim().max(200).optional().default(''), city: z.string().trim().min(1).max(100), province: z.string().trim().min(1).max(100), postalCode: z.string().trim().min(1).max(20), country: z.string().trim().min(1).max(80)
    }).strict(),
    shippingMethod: z.enum(['standard', 'whiteGlove', 'pickup']),
    deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    deliveryTime: z.string().trim().min(1).max(80)
  }).strict()
}).strict()

const statusQuery = z.object({ token: z.string().trim().min(32).max(200) }).strict()
const pageQuery = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(PAGE_SIZE) })

const shippingFees = { standard: 0, whiteGlove: 2500, pickup: 0 }

function currencyAmount(value) {
  return Number(Number(value || 0).toFixed(2))
}

function toCentavos(value) {
  return Math.round(currencyAmount(value) * 100)
}

function modeFromGateway(gateway) {
  return gateway.useTestMode ? TEST : LIVE
}

function trimBaseUrl(value) {
  return String(value || '').replace(/\/$/, '')
}

function serializeGateway(gateway) {
  const credentials = Object.fromEntries((gateway.credentials || []).map((credential) => [credential.mode.toLowerCase(), {
    configured: true,
    publicKey: credential.publicKey,
    publicKeyMasked: `${credential.publicKey.slice(0, 8)}••••${credential.publicKey.slice(-4)}`,
    sendEmailReceipt: credential.sendEmailReceipt,
    baseUrl: credential.baseUrl
  }]))
  return {
    id: gateway.id, provider: gateway.provider, isEnabled: gateway.isEnabled, useTestMode: gateway.useTestMode,
    activeMode: modeFromGateway(gateway), createdAt: gateway.createdAt, updatedAt: gateway.updatedAt,
    credentials, webhookCount: gateway._count?.webhooks ?? gateway.webhooks?.length ?? 0
  }
}

function serializeWebhook(webhook) {
  return { id: webhook.id, mode: webhook.credential?.mode, providerWebhookId: webhook.providerWebhookId, eventType: webhook.eventType, url: webhook.url, status: webhook.status, createdAt: webhook.createdAt, updatedAt: webhook.updatedAt }
}

function serializePayment(payment, detail = false) {
  const customer = payment.order?.customer || {}
  const result = {
    id: payment.id, orderId: payment.orderId, orderNumber: payment.order?.orderNumber || null,
    customerName: [customer.firstName, customer.lastName].filter(Boolean).join(' ') || null, customerEmail: customer.email || null,
    provider: payment.provider, mode: payment.mode, status: payment.status, amount: currencyAmount(payment.amount), currencyCode: payment.currencyCode,
    providerCheckoutSessionId: payment.providerCheckoutSessionId, providerPaymentIntentId: payment.providerPaymentIntentId,
    providerPaymentId: payment.providerPaymentId, paymentMethod: payment.paymentMethod, fee: payment.fee === null ? null : currencyAmount(payment.fee), netAmount: payment.netAmount === null ? null : currencyAmount(payment.netAmount),
    paidAt: payment.paidAt, createdAt: payment.createdAt, updatedAt: payment.updatedAt
  }
  if (detail) {
    result.order = payment.order ? { ...payment.order, subtotal: currencyAmount(payment.order.subtotal), shippingFee: currencyAmount(payment.order.shippingFee), total: currencyAmount(payment.order.total) } : null
    result.attempts = (payment.attempts || []).map((attempt) => ({ ...attempt, amount: attempt.amount === null ? null : currencyAmount(attempt.amount), fee: attempt.fee === null ? null : currencyAmount(attempt.fee), netAmount: attempt.netAmount === null ? null : currencyAmount(attempt.netAmount) }))
    result.webhookLogs = (payment.webhookLogs || []).map((log) => ({ id: log.id, eventType: log.eventType, signatureVerified: log.signatureVerified, processedAt: log.processedAt, processingError: log.processingError, createdAt: log.createdAt, payload: log.payload }))
  }
  return result
}

function credentialForMode(gateway, mode = modeFromGateway(gateway)) {
  const credential = gateway.credentials?.find((entry) => entry.mode === mode)
  if (!credential) throw new HttpError(409, `${mode === TEST ? 'Test' : 'Live'} PayMongo credentials are not configured`)
  return credential
}

function requireConfiguredCredential(input, existing, mode) {
  const publicKey = input?.publicKey ?? existing?.publicKey
  const secretKey = input?.secretKey
  if (!publicKey || (!secretKey && !existing?.secretKeyCiphertext)) throw new HttpError(400, `${mode === TEST ? 'Test' : 'Live'} public and secret keys are required`)
  return { publicKey, secretKey, sendEmailReceipt: input?.sendEmailReceipt ?? existing?.sendEmailReceipt ?? false }
}

function safeProviderError(error) {
  return error instanceof HttpError ? error : new HttpError(502, 'PayMongo request failed')
}

async function saveCredentials(prisma, gateway, body, config) {
  const current = new Map((gateway.credentials || []).map((credential) => [credential.mode, credential]))
  const desiredModes = [[TEST, body.test], [LIVE, body.live]]
  const activeMode = body.useTestMode ? TEST : LIVE
  const writes = []
  for (const [mode, input] of desiredModes) {
    const existing = current.get(mode)
    if (!input && !(mode === activeMode && !existing)) continue
    const value = requireConfiguredCredential(input, existing, mode)
    const data = {
      baseUrl,
      publicKey: value.publicKey,
      sendEmailReceipt: value.sendEmailReceipt,
      ...(value.secretKey ? { secretKeyCiphertext: encryptPaymentSecret(value.secretKey, config.PAYMENT_CREDENTIAL_ENCRYPTION_KEY), secretKeyFingerprint: paymentSecretFingerprint(value.secretKey) } : {})
    }
    writes.push(existing
      ? prisma.paymentGatewayCredential.update({ where: { id: existing.id }, data })
      : prisma.paymentGatewayCredential.create({ data: { gatewayId: gateway.id, mode, ...data, secretKeyCiphertext: data.secretKeyCiphertext, secretKeyFingerprint: data.secretKeyFingerprint } }))
  }
  if (writes.length) await prisma.$transaction(writes)
}

function checkoutReturnUrl(config, orderNumber, token, kind) {
  const url = new URL('/checkout/return', config.STOREFRONT_PUBLIC_URL)
  url.searchParams.set('order', orderNumber)
  url.searchParams.set('token', token)
  url.searchParams.set('result', kind)
  return url.toString()
}

function paymentFieldsFromResource(resource) {
  const attributes = resource?.attributes || {}
  const payments = Array.isArray(attributes.payments) ? attributes.payments : []
  const providerPayment = resource?.type === 'payment'
    ? resource
    : payments.find((entry) => entry?.attributes?.status === 'paid') || payments[payments.length - 1] || null
  const paymentAttributes = providerPayment?.attributes || {}
  return {
    checkoutSessionId: resource?.type === 'checkout_session' ? resource.id : null,
    paymentIntentId: attributes.payment_intent?.id || paymentAttributes.payment_intent_id || null,
    providerPaymentId: providerPayment?.id || null,
    referenceNumber: attributes.reference_number || paymentAttributes.external_reference_number || paymentAttributes.metadata?.order_number || null,
    paymentMethod: paymentAttributes.source?.type || null,
    amount: paymentAttributes.amount === undefined ? null : currencyAmount(paymentAttributes.amount / 100),
    fee: paymentAttributes.fee === undefined || paymentAttributes.fee === null ? null : currencyAmount(paymentAttributes.fee / 100),
    netAmount: paymentAttributes.net_amount === undefined || paymentAttributes.net_amount === null ? null : currencyAmount(paymentAttributes.net_amount / 100)
  }
}

async function findPaymentForEvent(prisma, resource, eventType) {
  const fields = paymentFieldsFromResource(resource)
  if (resource?.type === 'checkout_session' && fields.checkoutSessionId) return prisma.payment.findUnique({ where: { providerCheckoutSessionId: fields.checkoutSessionId }, include: { order: true } })
  if (fields.providerPaymentId) {
    const direct = await prisma.payment.findUnique({ where: { providerPaymentId: fields.providerPaymentId }, include: { order: true } })
    if (direct) return direct
  }
  if (fields.paymentIntentId) return prisma.payment.findFirst({ where: { OR: [{ providerPaymentIntentId: fields.paymentIntentId }, { attempts: { some: { providerPaymentIntentId: fields.paymentIntentId } } }] }, include: { order: true } })
  if (fields.referenceNumber) return prisma.payment.findFirst({ where: { order: { orderNumber: fields.referenceNumber } }, orderBy: { createdAt: 'desc' }, include: { order: true } })
  return null
}

async function upsertAttempt(prisma, payment, fields, status, resource) {
  if (!fields.paymentIntentId && !fields.providerPaymentId) return null
  const existing = (fields.providerPaymentId && await prisma.paymentAttempt.findUnique({ where: { providerPaymentId: fields.providerPaymentId } }))
    || (fields.paymentIntentId && await prisma.paymentAttempt.findUnique({ where: { providerPaymentIntentId: fields.paymentIntentId } }))
  const data = {
    paymentId: payment.id, providerPaymentIntentId: fields.paymentIntentId, providerPaymentId: fields.providerPaymentId,
    status, paymentMethod: fields.paymentMethod, amount: fields.amount, fee: fields.fee, netAmount: fields.netAmount, providerPayload: resource
  }
  return existing ? prisma.paymentAttempt.update({ where: { id: existing.id }, data }) : prisma.paymentAttempt.create({ data })
}

export function paymentWebhookRoutes({ prisma, config }) {
  const router = express.Router()
  router.post('/paymongo/:webhookId', express.raw({ type: 'application/json', limit: '1mb' }), asyncRoute(async (req, res) => {
    const webhookId = z.string().uuid().parse(req.params.webhookId)
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
    let parsed
    try { parsed = JSON.parse(rawBody.toString('utf8')) } catch { throw new HttpError(400, 'Invalid PayMongo webhook payload') }
    const envelope = parsed?.data || {}
    const eventType = envelope?.attributes?.type || envelope?.type || null
    const providerEventId = envelope?.id || null
    const liveMode = Boolean(envelope?.attributes?.livemode ?? envelope?.livemode)
    const webhook = await prisma.paymentGatewayWebhook.findUnique({ where: { id: webhookId }, include: { credential: true } })
    if (!webhook) throw new HttpError(404, 'Webhook not found')
    const secret = decryptPaymentSecret(webhook.signingSecretCiphertext, config.PAYMENT_CREDENTIAL_ENCRYPTION_KEY)
    const valid = verifyPaymongoSignature({ signature: req.get('Paymongo-Signature'), payload: rawBody, secret, liveMode }) && webhook.credential.mode === (liveMode ? LIVE : TEST)
    if (!valid) {
      await prisma.paymentWebhookLog.create({ data: { webhookId, providerEventId, eventType, payload: parsed, signatureVerified: false, processingError: 'Invalid webhook signature' } }).catch(() => {})
      throw new HttpError(401, 'Invalid PayMongo webhook signature')
    }
    let log
    try {
      log = await prisma.paymentWebhookLog.create({ data: { webhookId, providerEventId, eventType, payload: parsed, signatureVerified: true } })
    } catch (error) {
      if (error?.code === 'P2002') return res.status(204).end()
      throw error
    }
    try {
      const resource = envelope?.attributes?.data || envelope?.data || null
      const payment = await findPaymentForEvent(prisma, resource, eventType)
      if (payment) {
        const fields = paymentFieldsFromResource(resource)
        if (eventType === 'checkout_session.payment.paid' || eventType === 'payment.paid') {
          await upsertAttempt(prisma, payment, fields, 'PAID', resource)
          await prisma.$transaction([
            prisma.payment.update({ where: { id: payment.id }, data: { status: 'PAID', providerCheckoutSessionId: fields.checkoutSessionId || payment.providerCheckoutSessionId, providerPaymentIntentId: fields.paymentIntentId || payment.providerPaymentIntentId, providerPaymentId: fields.providerPaymentId || payment.providerPaymentId, paymentMethod: fields.paymentMethod || payment.paymentMethod, amount: fields.amount ?? payment.amount, fee: fields.fee, netAmount: fields.netAmount, providerPayload: resource, paidAt: new Date() } }),
            prisma.order.update({ where: { id: payment.orderId }, data: { paymentStatus: 'PAID' } }),
            prisma.paymentWebhookLog.update({ where: { id: log.id }, data: { paymentId: payment.id, processedAt: new Date() } })
          ])
        } else if (eventType === 'payment.failed') {
          await upsertAttempt(prisma, payment, fields, 'FAILED', resource)
          await prisma.paymentWebhookLog.update({ where: { id: log.id }, data: { paymentId: payment.id, processedAt: new Date() } })
        } else {
          await prisma.paymentWebhookLog.update({ where: { id: log.id }, data: { paymentId: payment.id, processedAt: new Date() } })
        }
      } else {
        await prisma.paymentWebhookLog.update({ where: { id: log.id }, data: { processingError: 'No matching payment was found', processedAt: new Date() } })
      }
    } catch (error) {
      await prisma.paymentWebhookLog.update({ where: { id: log.id }, data: { processingError: error.message || 'Webhook processing failed' } }).catch(() => {})
      throw error
    }
    res.status(204).end()
  }))
  return router
}

export function paymentsRoutes({ prisma, config, authenticate, authorize, fetchImpl }) {
  const router = express.Router()

  router.post('/checkout', asyncRoute(async (req, res) => {
    const body = checkoutSchema.parse(req.body)
    const gateway = await prisma.paymentGateway.findFirst({ where: { provider: PAYMONGO, isEnabled: true, deletedAt: null }, include: { credentials: true } })
    if (!gateway) throw new HttpError(409, 'Online payment is not available yet. Please contact Caracole PH.')
    const credential = credentialForMode(gateway)
    const requested = new Map()
    for (const item of body.items) requested.set(item.id, Math.min(99, (requested.get(item.id) || 0) + item.quantity))
    const products = await prisma.product.findMany({ where: { shopifyId: { in: [...requested.keys()] }, isActive: true, availableForSale: true }, select: { shopifyId: true, title: true, sku: true, price: true, currencyCode: true, featuredImageUrl: true } })
    if (products.length !== requested.size) throw new HttpError(409, 'One or more products are no longer available for purchase')
    const items = products.map((product) => {
      if (product.currencyCode && product.currencyCode !== 'PHP') throw new HttpError(409, 'Only PHP products can be paid through PayMongo')
      const price = currencyAmount(product.price)
      if (price <= 0) throw new HttpError(409, `${product.title} does not have a valid price`)
      const quantity = requested.get(product.shopifyId)
      return { productId: product.shopifyId, name: product.title, sku: product.sku || null, image: product.featuredImageUrl || null, quantity, unitPrice: price, total: currencyAmount(price * quantity) }
    })
    const subtotal = currencyAmount(items.reduce((sum, item) => sum + item.total, 0))
    const shippingFee = shippingFees[body.checkout.shippingMethod]
    const total = currencyAmount(subtotal + shippingFee)
    const accessToken = createPaymentAccessToken()
    const orderNumber = `CAR-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
    const [order, payment] = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({ data: { orderNumber, accessTokenHash: hashPaymentAccessToken(accessToken), customer: body.checkout.customer, delivery: { shippingMethod: body.checkout.shippingMethod, deliveryDate: body.checkout.deliveryDate, deliveryTime: body.checkout.deliveryTime }, items, subtotal, shippingFee, total } })
      const payment = await tx.payment.create({ data: { orderId: order.id, gatewayId: gateway.id, credentialId: credential.id, provider: PAYMONGO, mode: credential.mode, amount: total } })
      return [order, payment]
    })
    const client = createPaymongoClient({ secretKey: decryptPaymentSecret(credential.secretKeyCiphertext, config.PAYMENT_CREDENTIAL_ENCRYPTION_KEY), fetchImpl })
    let response
    try {
      response = await client.createCheckoutSession({
        line_items: items.map((item) => ({ name: item.name, amount: toCentavos(item.unitPrice), currency: 'PHP', quantity: item.quantity, ...(item.image ? { images: [item.image] } : {}) })),
        payment_method_types: PAYMONGO_PAYMENT_METHOD_TYPES,
        pass_on_fees: false,
        success_url: checkoutReturnUrl(config, order.orderNumber, accessToken, 'success'),
        cancel_url: checkoutReturnUrl(config, order.orderNumber, accessToken, 'cancel'),
        reference_number: order.orderNumber,
        send_email_receipt: credential.sendEmailReceipt,
        billing: { name: `${body.checkout.customer.firstName} ${body.checkout.customer.lastName}`, email: body.checkout.customer.email, phone: body.checkout.customer.phone, address: { line1: body.checkout.customer.address, line2: body.checkout.customer.apartment || undefined, city: body.checkout.customer.city, state: body.checkout.customer.province, postal_code: body.checkout.customer.postalCode, country: 'PH' } },
        metadata: { order_id: order.id, order_number: order.orderNumber }
      })
    } catch (error) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } })
      await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'FAILED' } })
      throw safeProviderError(error)
    }
    const session = response?.data
    const checkoutUrl = session?.attributes?.checkout_url
    if (!session?.id || !checkoutUrl) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } })
      await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'FAILED' } })
      throw new HttpError(502, 'PayMongo did not return a checkout URL')
    }
    await prisma.payment.update({ where: { id: payment.id }, data: { providerCheckoutSessionId: session.id, checkoutUrl, providerPayload: session } })
    res.status(201).json({ checkoutUrl, orderNumber: order.orderNumber, accessToken })
  }))

  router.get('/orders/:orderNumber/status', asyncRoute(async (req, res) => {
    const orderNumber = z.string().trim().min(1).max(80).parse(req.params.orderNumber)
    const { token } = statusQuery.parse(req.query)
    const order = await prisma.order.findUnique({ where: { orderNumber } })
    if (!order || order.accessTokenHash !== hashPaymentAccessToken(token)) throw new HttpError(404, 'Order not found')
    res.json({ order: { orderNumber: order.orderNumber, paymentStatus: order.paymentStatus, total: currencyAmount(order.total), currencyCode: order.currencyCode, createdAt: order.createdAt } })
  }))

  router.use(authenticate, authorize('staff'))

  router.get('/gateways', asyncRoute(async (req, res) => {
    const query = pageQuery.parse(req.query)
    const where = { deletedAt: null }
    const [totalItems, gateways] = await prisma.$transaction([
      prisma.paymentGateway.count({ where }),
      prisma.paymentGateway.findMany({ where, include: { credentials: true, _count: { select: { webhooks: true } } }, orderBy: { updatedAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit })
    ])
    res.json({ gateways: gateways.map(serializeGateway), pagination: { page: query.page, limit: query.limit, totalItems, totalPages: Math.ceil(totalItems / query.limit) } })
  }))

  router.post('/gateways/paymongo/test-credentials', asyncRoute(async (req, res) => {
    const body = credentialTestSchema.parse(req.body)
    let secretKey = body.secretKey
    if (!secretKey) {
      if (!body.gatewayId) throw new HttpError(400, 'Enter a secret key before testing credentials')
      const gateway = await prisma.paymentGateway.findFirst({ where: { id: body.gatewayId, provider: PAYMONGO, deletedAt: null }, include: { credentials: true } })
      if (!gateway) throw new HttpError(404, 'Payment gateway not found')
      const credential = credentialForMode(gateway, body.mode)
      secretKey = decryptPaymentSecret(credential.secretKeyCiphertext, config.PAYMENT_CREDENTIAL_ENCRYPTION_KEY)
    }
    await createPaymongoClient({ secretKey, fetchImpl }).verifyCredentials()
    res.json({ message: `${body.mode === TEST ? 'Test' : 'Live'} PayMongo credentials are valid.` })
  }))

  router.post('/gateways/paymongo', asyncRoute(async (req, res) => {
    const body = gatewaySchema.parse(req.body)
    let gateway = await prisma.paymentGateway.findUnique({ where: { provider: PAYMONGO }, include: { credentials: true } })
    if (gateway && !gateway.deletedAt) throw new HttpError(409, 'PayMongo is already connected')
    if (gateway?.deletedAt) {
      gateway = await prisma.paymentGateway.update({ where: { id: gateway.id }, data: { deletedAt: null, isEnabled: body.isEnabled, useTestMode: body.useTestMode }, include: { credentials: true } })
    } else {
      gateway = await prisma.paymentGateway.create({ data: { provider: PAYMONGO, isEnabled: body.isEnabled, useTestMode: body.useTestMode }, include: { credentials: true } })
    }
    await saveCredentials(prisma, gateway, body, config)
    const saved = await prisma.paymentGateway.findUnique({ where: { id: gateway.id }, include: { credentials: true, _count: { select: { webhooks: true } } } })
    res.status(201).json({ gateway: serializeGateway(saved) })
  }))

  router.patch('/gateways/:id', asyncRoute(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id)
    const body = gatewaySchema.parse(req.body)
    const gateway = await prisma.paymentGateway.findFirst({ where: { id, provider: PAYMONGO, deletedAt: null }, include: { credentials: true } })
    if (!gateway) throw new HttpError(404, 'Payment gateway not found')
    await saveCredentials(prisma, gateway, body, config)
    await prisma.paymentGateway.update({ where: { id }, data: { isEnabled: body.isEnabled, useTestMode: body.useTestMode } })
    const saved = await prisma.paymentGateway.findUnique({ where: { id }, include: { credentials: true, _count: { select: { webhooks: true } } } })
    res.json({ gateway: serializeGateway(saved) })
  }))

  router.delete('/gateways/:id', asyncRoute(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id)
    const gateway = await prisma.paymentGateway.findFirst({ where: { id, provider: PAYMONGO, deletedAt: null }, include: { credentials: true, webhooks: { include: { credential: true } } } })
    if (!gateway) throw new HttpError(404, 'Payment gateway not found')
    for (const webhook of gateway.webhooks) {
      const client = createPaymongoClient({ secretKey: decryptPaymentSecret(webhook.credential.secretKeyCiphertext, config.PAYMENT_CREDENTIAL_ENCRYPTION_KEY), fetchImpl })
      await client.deleteWebhook(webhook.providerWebhookId)
    }
    await prisma.$transaction([
      prisma.paymentGatewayWebhook.deleteMany({ where: { gatewayId: id } }),
      prisma.paymentGateway.update({ where: { id }, data: { isEnabled: false, deletedAt: new Date() } })
    ])
    res.status(204).end()
  }))

  router.get('/gateways/:id/webhooks', asyncRoute(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id)
    const mode = z.enum([TEST, LIVE]).parse(req.query.mode)
    const webhooks = await prisma.paymentGatewayWebhook.findMany({ where: { gatewayId: id, credential: { mode } }, include: { credential: true }, orderBy: { createdAt: 'desc' } })
    res.json({ webhooks: webhooks.map(serializeWebhook), events: PAYMONGO_WEBHOOK_EVENTS })
  }))

  router.post('/gateways/:id/webhooks', asyncRoute(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id)
    const body = webhookSchema.parse(req.body)
    const gateway = await prisma.paymentGateway.findFirst({ where: { id, provider: PAYMONGO, deletedAt: null }, include: { credentials: true } })
    if (!gateway) throw new HttpError(404, 'Payment gateway not found')
    const credential = credentialForMode(gateway, body.mode)
    const webhookId = crypto.randomUUID()
    const suggestedUrl = `${trimBaseUrl(config.PAYMENT_WEBHOOK_PUBLIC_BASE_URL)}/api/v1/payments/webhooks/paymongo/${webhookId}`
    const url = body.url || suggestedUrl
    if (!url.startsWith('https://') && !url.startsWith('http://localhost')) throw new HttpError(400, 'Webhook URL must use HTTPS')
    const client = createPaymongoClient({ secretKey: decryptPaymentSecret(credential.secretKeyCiphertext, config.PAYMENT_CREDENTIAL_ENCRYPTION_KEY), fetchImpl })
    const response = await client.createWebhook({ eventType: body.eventType, url })
    const provider = response?.data
    const secret = provider?.attributes?.secret_key
    if (!provider?.id || !secret) throw new HttpError(502, 'PayMongo did not return a webhook signing secret')
    const webhook = await prisma.paymentGatewayWebhook.create({ data: { id: webhookId, gatewayId: id, credentialId: credential.id, providerWebhookId: provider.id, eventType: body.eventType, url, status: provider.attributes?.status || 'enabled', signingSecretCiphertext: encryptPaymentSecret(secret, config.PAYMENT_CREDENTIAL_ENCRYPTION_KEY), signingSecretFingerprint: paymentSecretFingerprint(secret) }, include: { credential: true } })
    res.status(201).json({ webhook: serializeWebhook(webhook) })
  }))

  router.delete('/gateways/:gatewayId/webhooks/:webhookId', asyncRoute(async (req, res) => {
    const gatewayId = z.string().uuid().parse(req.params.gatewayId)
    const webhookId = z.string().uuid().parse(req.params.webhookId)
    const mode = z.enum([TEST, LIVE]).parse(req.query.mode)
    const webhook = await prisma.paymentGatewayWebhook.findFirst({ where: { id: webhookId, gatewayId, credential: { mode } }, include: { credential: true } })
    if (!webhook) throw new HttpError(404, 'Webhook not found')
    const client = createPaymongoClient({ secretKey: decryptPaymentSecret(webhook.credential.secretKeyCiphertext, config.PAYMENT_CREDENTIAL_ENCRYPTION_KEY), fetchImpl })
    await client.deleteWebhook(webhook.providerWebhookId)
    await prisma.paymentGatewayWebhook.delete({ where: { id: webhookId } })
    res.status(204).end()
  }))

  router.get('/', asyncRoute(async (req, res) => {
    const query = pageQuery.parse(req.query)
    const [totalItems, payments] = await prisma.$transaction([
      prisma.payment.count(),
      prisma.payment.findMany({ include: { order: true }, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit })
    ])
    res.json({ payments: payments.map((payment) => serializePayment(payment)), pagination: { page: query.page, limit: query.limit, totalItems, totalPages: Math.ceil(totalItems / query.limit) } })
  }))

  router.get('/:id', asyncRoute(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id)
    const payment = await prisma.payment.findUnique({ where: { id }, include: { order: true, attempts: { orderBy: { createdAt: 'desc' } }, webhookLogs: { orderBy: { createdAt: 'desc' } } } })
    if (!payment) throw new HttpError(404, 'Payment not found')
    res.json({ payment: serializePayment(payment, true) })
  }))

  return router
}

export { PAYMONGO_PAYMENT_METHOD_TYPES, PAYMONGO_WEBHOOK_EVENTS, serializeGateway, serializePayment }
