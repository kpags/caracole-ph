import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { errorHandler } from '../src/lib/http.js'
import { normalizeRecipientGroups } from '../src/lib/email-recipients.js'
import { emailingRoutes } from '../src/routes/emailing.js'

function createHarness() {
  const configurations = new Map()
  const sentTests = []
  const prisma = {
    emailNotificationRecipient: {
      async findMany() { return [...configurations.values()] },
      async findUnique({ where }) { return configurations.get(where.event) || null },
      async upsert({ where, create, update }) {
        const saved = { ...(configurations.get(where.event) || create), ...(configurations.has(where.event) ? update : {}), event: where.event, updatedAt: new Date('2026-09-04T00:00:00.000Z') }
        configurations.set(where.event, saved)
        return saved
      }
    }
  }
  const app = express()
  app.use(express.json())
  app.use('/api/v1/emailing', emailingRoutes({
    prisma,
    config: { APP_NAME: 'Caracole PH' },
    mailer: { async sendEmailNotificationTest(payload) { sentTests.push(payload) } },
    authenticate: (req, _res, next) => {
      req.user = { id: 'staff-id', email: 'tester@caracole.ph', isStaff: true, isSuperuser: false }
      next()
    },
    authorize: () => (_req, _res, next) => next()
  }))
  app.use(errorHandler)
  return { app, configurations, sentTests }
}

test('email notification recipients save To, CC, and BCC separately and remove cross-list duplicates', async () => {
  const { app, configurations } = createHarness()
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/emailing/recipients/PRODUCT_INQUIRY`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: ['Sales@Caracole.ph', 'sales@caracole.ph'], cc: ['sales@caracole.ph', 'Manager@Caracole.ph'], bcc: ['manager@caracole.ph', 'audit@caracole.ph'] })
    })
    const body = await response.json()
    assert.equal(response.status, 200)
    assert.deepEqual(body.recipients, { event: 'PRODUCT_INQUIRY', to: ['sales@caracole.ph'], cc: ['manager@caracole.ph'], bcc: ['audit@caracole.ph'], updatedAt: '2026-09-04T00:00:00.000Z' })
    assert.deepEqual(configurations.get('PRODUCT_INQUIRY').toRecipients, ['sales@caracole.ph'])
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('recipient groups reject invalid email addresses', () => {
  assert.throws(() => normalizeRecipientGroups({ to: ['not-an-email'] }))
})

test('test emails use unsaved normalized recipient groups for every emailing event', async () => {
  const { app, configurations, sentTests } = createHarness()
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  try {
    for (const [event, email] of [['GENERAL_INQUIRY', 'general@caracole.ph'], ['PRODUCT_INQUIRY', 'product@caracole.ph'], ['DESIGNER_REGISTRATION', 'designer@caracole.ph']]) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/emailing/recipients/${event}/test`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: [email, email.toUpperCase()], cc: ['copy@caracole.ph'], bcc: ['copy@caracole.ph', 'private@caracole.ph'] })
      })
      assert.equal(response.status, 200)
    }

    assert.equal(configurations.size, 0)
    assert.deepEqual(sentTests, [
      { event: 'GENERAL_INQUIRY', recipients: { to: ['general@caracole.ph'], cc: ['copy@caracole.ph'], bcc: ['private@caracole.ph'] }, testerEmail: 'tester@caracole.ph', config: { APP_NAME: 'Caracole PH' } },
      { event: 'PRODUCT_INQUIRY', recipients: { to: ['product@caracole.ph'], cc: ['copy@caracole.ph'], bcc: ['private@caracole.ph'] }, testerEmail: 'tester@caracole.ph', config: { APP_NAME: 'Caracole PH' } },
      { event: 'DESIGNER_REGISTRATION', recipients: { to: ['designer@caracole.ph'], cc: ['copy@caracole.ph'], bcc: ['private@caracole.ph'] }, testerEmail: 'tester@caracole.ph', config: { APP_NAME: 'Caracole PH' } }
    ])
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('test email requires at least one recipient', async () => {
  const { app, sentTests } = createHarness()
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/emailing/recipients/GENERAL_INQUIRY/test`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: [], cc: [], bcc: [] })
    })
    const body = await response.json()
    assert.equal(response.status, 422)
    assert.equal(body.message, 'Add at least one recipient before sending a test email')
    assert.deepEqual(sentTests, [])
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
