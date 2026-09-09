import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import express from 'express'
import { createPaymongoClient, PAYMONGO_PAYMENT_METHOD_TYPES } from '../src/lib/paymongo.js'
import { decryptPaymentSecret, encryptPaymentSecret, hashPaymentAccessToken, verifyPaymongoSignature } from '../src/lib/payment-crypto.js'
import { errorHandler } from '../src/lib/http.js'
import { assignActiveGateway, paymentWebhookRoutes, paymentsRoutes, serializeGateway, serializePayment } from '../src/routes/payments.js'

const encryptionKey = Buffer.from('0123456789abcdef0123456789abcdef').toString('base64')

async function withServer(app, run) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  const origin = `http://127.0.0.1:${server.address().port}`
  try { await run(origin) } finally { await new Promise((resolve) => server.close(resolve)) }
}

test('payment secrets are encrypted, decryptable by the server, and fingerprinted access tokens are one way', () => {
  const encrypted = encryptPaymentSecret('sk_test_example_secret', encryptionKey)
  assert.notEqual(encrypted, 'sk_test_example_secret')
  assert.equal(decryptPaymentSecret(encrypted, encryptionKey), 'sk_test_example_secret')
  assert.notEqual(hashPaymentAccessToken('token-one'), 'token-one')
  assert.equal(hashPaymentAccessToken('token-one'), hashPaymentAccessToken('token-one'))
})

test('PayMongo signatures use the correct test/live header value and reject stale payloads', () => {
  const payload = Buffer.from('{"data":{"id":"evt_test"}}')
  const timestamp = Math.floor(Date.now() / 1000)
  const testSignature = crypto.createHmac('sha256', 'whsk_test').update(`${timestamp}.${payload}`).digest('hex')
  const liveSignature = crypto.createHmac('sha256', 'whsk_live').update(`${timestamp}.${payload}`).digest('hex')
  const header = `t=${timestamp},te=${testSignature},li=${liveSignature}`
  assert.equal(verifyPaymongoSignature({ signature: header, payload, secret: 'whsk_test', liveMode: false }), true)
  assert.equal(verifyPaymongoSignature({ signature: header, payload, secret: 'whsk_live', liveMode: true }), true)
  assert.equal(verifyPaymongoSignature({ signature: `t=${timestamp - 1000},te=${testSignature}`, payload, secret: 'whsk_test', liveMode: false }), false)
})

test('PayMongo Hosted Checkout requests use secret-key basic auth and return the provider checkout URL', async () => {
  let request
  const client = createPaymongoClient({ secretKey: 'sk_test_abc', fetchImpl: async (url, init) => {
    request = { url, init }
    return new Response(JSON.stringify({ data: { id: 'cs_test_123', attributes: { checkout_url: 'https://checkout.paymongo.com/cs_test_123' } } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } })
  const response = await client.createCheckoutSession({ line_items: [{ name: 'Chair', amount: 10000, currency: 'PHP', quantity: 1 }], payment_method_types: PAYMONGO_PAYMENT_METHOD_TYPES, pass_on_fees: false, success_url: 'https://caracole.ph/checkout/return', cancel_url: 'https://caracole.ph/checkout/return', reference_number: 'CAR-1' })
  assert.equal(request.url, 'https://api.paymongo.com/v2/checkout_sessions')
  assert.equal(request.init.headers.Authorization, `Basic ${Buffer.from('sk_test_abc:').toString('base64')}`)
  assert.equal(JSON.parse(request.init.body).data.attributes.line_items[0].amount, 10000)
  assert.equal(JSON.parse(request.init.body).data.attributes.pass_on_fees, false)
  assert.equal(response.data.attributes.checkout_url, 'https://checkout.paymongo.com/cs_test_123')
})

test('PayMongo credential verification uses an authenticated read-only request', async () => {
  let request
  const client = createPaymongoClient({ secretKey: 'sk_test_abc', fetchImpl: async (url, init) => {
    request = { url, init }
    return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } })
  await client.verifyCredentials()
  assert.equal(request.url, 'https://api.paymongo.com/v1/webhooks')
  assert.equal(request.init.method, 'GET')
  assert.equal(request.init.headers.Authorization, `Basic ${Buffer.from('sk_test_abc:').toString('base64')}`)
})

test('an authorized pending order status includes its saved checkout link for payment resumption', async () => {
  const token = 'a'.repeat(40)
  const order = { orderNumber: 'CAR-RESUME', accessTokenHash: hashPaymentAccessToken(token), paymentStatus: 'PENDING', total: 25000, currencyCode: 'PHP', createdAt: new Date(), payments: [{ status: 'PENDING', checkoutUrl: 'https://checkout.paymongo.com/cs_resume' }] }
  const app = express()
  app.use('/api/v1/payments', paymentsRoutes({
    prisma: { order: { async findUnique() { return order } } },
    config: {},
    authenticate: (_req, _res, next) => next(),
    authorize: () => (_req, _res, next) => next()
  }))
  app.use(errorHandler)
  await withServer(app, async (origin) => {
    const response = await fetch(`${origin}/api/v1/payments/orders/CAR-RESUME/status?token=${token}`)
    const body = await response.json()
    assert.equal(response.status, 200)
    assert.equal(body.order.checkoutUrl, 'https://checkout.paymongo.com/cs_resume')
  })
})

test('assigning an active gateway atomically replaces the previous active gateway', async () => {
  const gateways = [{ id: 'gateway-test', isActive: true, deletedAt: null }, { id: 'gateway-live', isActive: false, deletedAt: null }]
  const paymentGateway = {
    async updateMany({ where, data }) {
      for (const gateway of gateways) {
        if (gateway.id !== where.id.not && gateway.isActive && gateway.deletedAt === null) gateway.isActive = data.isActive
      }
    },
    async update({ where, data }) {
      const gateway = gateways.find((entry) => entry.id === where.id)
      Object.assign(gateway, data)
      return gateway
    }
  }
  const prisma = { paymentGateway, async $transaction(work) { return work({ paymentGateway }) } }
  await assignActiveGateway(prisma, 'gateway-live', true)
  assert.deepEqual(gateways.map((gateway) => gateway.isActive), [false, true])
  await assignActiveGateway(prisma, 'gateway-live', false)
  assert.deepEqual(gateways.map((gateway) => gateway.isActive), [false, false])
})

test('Test and Live webhook registrations, lists, and deletions stay isolated by credential mode', async () => {
  const gatewayId = crypto.randomUUID()
  const testCredential = { id: crypto.randomUUID(), gatewayId, mode: 'TEST', publicKey: 'pk_test_12345678', secretKeyCiphertext: encryptPaymentSecret('sk_test_mode_secret', encryptionKey), sendEmailReceipt: false }
  const liveCredential = { id: crypto.randomUUID(), gatewayId, mode: 'LIVE', publicKey: 'pk_live_12345678', secretKeyCiphertext: encryptPaymentSecret('sk_live_mode_secret', encryptionKey), sendEmailReceipt: false }
  const gateway = { id: gatewayId, provider: 'PAYMONGO', deletedAt: null, credentials: [testCredential, liveCredential] }
  const webhooks = []
  const providerRequests = []
  const prisma = {
    paymentGateway: {
      async findFirst({ where }) { return where.id === gatewayId && where.provider === 'PAYMONGO' && !gateway.deletedAt ? gateway : null }
    },
    paymentGatewayWebhook: {
      async findMany({ where }) { return webhooks.filter((webhook) => webhook.gatewayId === where.gatewayId && webhook.credential.mode === where.credential.mode) },
      async create({ data }) {
        const credential = gateway.credentials.find((entry) => entry.id === data.credentialId)
        const webhook = { ...data, createdAt: new Date(), updatedAt: new Date(), credential }
        webhooks.push(webhook)
        return webhook
      },
      async findFirst({ where }) { return webhooks.find((webhook) => webhook.id === where.id && webhook.gatewayId === where.gatewayId && webhook.credential.mode === where.credential.mode) || null },
      async delete({ where }) { const index = webhooks.findIndex((webhook) => webhook.id === where.id); if (index >= 0) webhooks.splice(index, 1) }
    }
  }
  let providerWebhookNumber = 0
  const app = express()
  app.use(express.json())
  app.use('/api/v1/payments', paymentsRoutes({
    prisma,
    config: { PAYMENT_CREDENTIAL_ENCRYPTION_KEY: encryptionKey, PAYMENT_WEBHOOK_PUBLIC_BASE_URL: 'https://api.caracole.ph', STOREFRONT_PUBLIC_URL: 'https://caracole.ph' },
    authenticate: (_req, _res, next) => next(),
    authorize: () => (_req, _res, next) => next(),
    fetchImpl: async (url, init) => {
      providerRequests.push({ url, init })
      providerWebhookNumber += 1
      return new Response(JSON.stringify({ data: { id: `wh_${providerWebhookNumber}`, attributes: { secret_key: `whsk_${providerWebhookNumber}`, status: 'enabled' } } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
  }))
  app.use(errorHandler)

  await withServer(app, async (origin) => {
    const register = async (mode) => {
      const response = await fetch(`${origin}/api/v1/payments/gateways/${gatewayId}/webhooks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, eventType: 'payment.paid' }) })
      return { status: response.status, body: await response.json() }
    }
    const testRegistration = await register('TEST')
    const liveRegistration = await register('LIVE')
    assert.equal(testRegistration.status, 201)
    assert.equal(liveRegistration.status, 201)
    assert.equal(testRegistration.body.webhook.mode, 'TEST')
    assert.equal(liveRegistration.body.webhook.mode, 'LIVE')
    assert.notEqual(testRegistration.body.webhook.url, liveRegistration.body.webhook.url)
    assert.equal(providerRequests[0].init.headers.Authorization, `Basic ${Buffer.from('sk_test_mode_secret:').toString('base64')}`)
    assert.equal(providerRequests[1].init.headers.Authorization, `Basic ${Buffer.from('sk_live_mode_secret:').toString('base64')}`)

    const testList = await fetch(`${origin}/api/v1/payments/gateways/${gatewayId}/webhooks?mode=TEST`).then((response) => response.json())
    const liveList = await fetch(`${origin}/api/v1/payments/gateways/${gatewayId}/webhooks?mode=LIVE`).then((response) => response.json())
    assert.deepEqual(testList.webhooks.map((webhook) => webhook.mode), ['TEST'])
    assert.deepEqual(liveList.webhooks.map((webhook) => webhook.mode), ['LIVE'])

    const wrongModeDelete = await fetch(`${origin}/api/v1/payments/gateways/${gatewayId}/webhooks/${liveRegistration.body.webhook.id}?mode=TEST`, { method: 'DELETE' })
    assert.equal(wrongModeDelete.status, 404)
    assert.equal(webhooks.length, 2)
    const correctDelete = await fetch(`${origin}/api/v1/payments/gateways/${gatewayId}/webhooks/${testRegistration.body.webhook.id}?mode=TEST`, { method: 'DELETE' })
    assert.equal(correctDelete.status, 204)
    assert.deepEqual(webhooks.map((webhook) => webhook.credential.mode), ['LIVE'])
  })
})

test('PayMongo webhook receiver rejects a payload whose live mode does not match its credential', async () => {
  const webhookId = crypto.randomUUID()
  const signingSecret = 'whsk_mode_mismatch'
  const payload = JSON.stringify({ data: { id: 'evt_test', attributes: { type: 'payment.paid', livemode: false, data: null } } })
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = crypto.createHmac('sha256', signingSecret).update(`${timestamp}.${payload}`).digest('hex')
  let paymentWrites = 0
  const app = express()
  app.use('/hooks', paymentWebhookRoutes({
    config: { PAYMENT_CREDENTIAL_ENCRYPTION_KEY: encryptionKey },
    prisma: {
      paymentGatewayWebhook: { async findUnique() { return { id: webhookId, credential: { mode: 'LIVE' }, signingSecretCiphertext: encryptPaymentSecret(signingSecret, encryptionKey) } } },
      paymentWebhookLog: { async create() { return { id: crypto.randomUUID() } }, async update() {} },
      payment: { async update() { paymentWrites += 1 } },
      order: { async update() { paymentWrites += 1 } }
    }
  }))
  app.use(errorHandler)
  await withServer(app, async (origin) => {
    const response = await fetch(`${origin}/hooks/paymongo/${webhookId}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Paymongo-Signature': `t=${timestamp},te=${signature}` }, body: payload })
    assert.equal(response.status, 401)
    assert.equal(paymentWrites, 0)
  })
})

test('gateway and payment serializers never expose encrypted secrets', () => {
  const gateway = serializeGateway({ id: 'gateway-1', provider: 'PAYMONGO', isEnabled: true, useTestMode: true, createdAt: new Date(), updatedAt: new Date(), credentials: [{ mode: 'TEST', publicKey: 'pk_test_1234567890', secretKeyCiphertext: 'must-not-leak', signingSecretCiphertext: 'must-not-leak', sendEmailReceipt: true }], _count: { webhooks: 1 } })
  assert.equal(gateway.credentials.test.publicKey, 'pk_test_1234567890')
  assert.equal(JSON.stringify(gateway).includes('must-not-leak'), false)
  const payment = serializePayment({ id: 'payment-1', orderId: 'order-1', provider: 'PAYMONGO', mode: 'TEST', status: 'PENDING', amount: 100, currencyCode: 'PHP', createdAt: new Date(), updatedAt: new Date(), order: { orderNumber: 'CAR-1', customer: { email: 'customer@example.com', firstName: 'Ava', lastName: 'Santos' } } })
  assert.equal(payment.orderNumber, 'CAR-1')
  assert.equal(payment.amount, 100)
})
