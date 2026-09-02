import assert from 'node:assert/strict'
import test from 'node:test'
import bcrypt from 'bcryptjs'
import express from 'express'
import { authRoutes } from '../src/routes/auth.js'
import { errorHandler } from '../src/lib/http.js'

function createHarness() {
  let user = null
  const sentOtps = []
  const config = {
    BCRYPT_SALT_ROUNDS: 4,
    JWT_ACCESS_SECRET: 'customer-auth-access-secret',
    JWT_REFRESH_SECRET: 'customer-auth-refresh-secret',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    APP_NAME: 'Caracole PH'
  }
  const prisma = {
    user: {
      async findUnique({ where }) { return user?.email === where.email ? { ...user } : null },
      async create({ data }) {
        const customer = data.customer?.create || null
        delete data.customer
        user = { id: 'customer-id', designer: null, isDesigner: false, isStaff: false, isSuperuser: false, customer, ...data }
        return { ...user }
      },
      async update({ where, data }) {
        assert.equal(where.id, user.id)
        const customer = data.customer?.create || data.customer?.upsert?.create || data.customer?.upsert?.update
        delete data.customer
        user = { ...user, ...data, ...(customer ? { customer: { ...user.customer, ...customer } } : {}) }
        return { ...user }
      }
    },
    refreshToken: { async updateMany() { return { count: 0 } } }
  }
  const auth = {
    async createOtp(userId, purpose) {
      assert.equal(userId, user.id)
      assert.equal(purpose, 'EMAIL_VERIFICATION')
      return '123456'
    },
    async verifyOtp(userId, purpose, otp) {
      assert.equal(userId, user.id)
      assert.equal(purpose, 'EMAIL_VERIFICATION')
      if (otp !== '123456') throw new Error('Invalid or expired OTP')
    },
    async issueTokens() { return { accessToken: 'access-token', refreshToken: 'refresh-token' } }
  }
  const mailer = { async sendOtp(payload) { sentOtps.push(payload) } }
  const app = express()
  app.use(express.json())
  const shopifyCustomers = {
    async create({ firstName, lastName, email }) { return { id: 'gid://shopify/Customer/1', firstName, lastName, email, phone: null } },
    async authenticate({ email }) { return { id: 'gid://shopify/Customer/1', firstName: user.firstName, lastName: user.lastName, email, phone: null } },
    async recover() {}
  }
  app.use('/api/v1/auth', authRoutes({ prisma, config, auth, mailer, shopifyCustomers }))
  app.use(errorHandler)
  return { app, sentOtps, getUser: () => user }
}

async function withServer(run) {
  const harness = createHarness()
  const server = await new Promise((resolve) => {
    const instance = harness.app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  const origin = `http://127.0.0.1:${server.address().port}`
  const request = async (path, body) => {
    const response = await fetch(`${origin}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return { status: response.status, body: await response.json() }
  }
  try { await run({ ...harness, request }) } finally { await new Promise((resolve) => server.close(resolve)) }
}

test('customer registration sends an OTP and activates only after verification', async () => {
  await withServer(async ({ request, sentOtps, getUser }) => {
    const registration = { firstName: 'Ava', lastName: 'Reyes', email: 'ava@example.com', password: 'eight-char-password', confirmPassword: 'eight-char-password' }
    let result = await request('/api/v1/auth/register', registration)
    assert.equal(result.status, 201)
    assert.equal(sentOtps.length, 1)
    assert.equal(sentOtps[0].email, registration.email)
    assert.equal(getUser().isActive, false)
    assert.equal(getUser().isEmailVerified, false)
    assert.equal(await bcrypt.compare(registration.password, getUser().password), false)

    result = await request('/api/v1/auth/login', { email: registration.email, password: registration.password })
    assert.equal(result.status, 403)

    result = await request('/api/v1/auth/resend-verification', { email: registration.email })
    assert.equal(result.status, 202)
    assert.equal(sentOtps.length, 2)

    result = await request('/api/v1/auth/verify-email', { email: registration.email, otp: '123456' })
    assert.equal(result.status, 200)
    assert.equal(getUser().isActive, true)
    assert.equal(getUser().isEmailVerified, true)

    result = await request('/api/v1/auth/login', { email: registration.email, password: registration.password })
    assert.equal(result.status, 200)
    assert.equal(result.body.user.firstName, 'Ava')
    assert.equal(result.body.accessToken, 'access-token')
  })
})

test('a pending Shopify customer can replace local registration details and receive a new OTP', async () => {
  await withServer(async ({ request, sentOtps, getUser }) => {
    const firstRegistration = { firstName: 'Ava', lastName: 'Reyes', email: 'ava@example.com', password: 'eight-char-password', confirmPassword: 'eight-char-password' }
    await request('/api/v1/auth/register', firstRegistration)

    const replacement = { ...firstRegistration, firstName: 'Ana', password: 'another-password', confirmPassword: 'another-password' }
    let result = await request('/api/v1/auth/register', replacement)
    assert.equal(result.status, 200)
    assert.equal(sentOtps.length, 2)
    assert.equal(getUser().firstName, 'Ana')

    await request('/api/v1/auth/verify-email', { email: replacement.email, otp: '123456' })
    result = await request('/api/v1/auth/register', replacement)
    assert.equal(result.status, 409)
  })
})
