import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { errorHandler } from '../src/lib/http.js'
import { configuredEmailRecipients, inquiriesRoutes, inquiryRecipients, serializeInquiry } from '../src/routes/inquiries.js'

function createHarness() {
  const inquiries = []
  const confirmations = []
  const notifications = []
  const prisma = {
    inquiry: {
      async create({ data }) {
        const inquiry = {
          id: `inquiry-${inquiries.length + 1}`,
          createdAt: new Date('2026-09-03T00:00:00.000Z'),
          ...data,
          status: 'PENDING'
        }
        inquiries.push(inquiry)
        return inquiry
      }
    }
  }
  const mailer = {
    async sendInquiryConfirmation(payload) { confirmations.push(payload) },
    async sendInquiryNotification(payload) { notifications.push(payload) }
  }
  const config = { APP_NAME: 'Caracole PH', INQUIRY_RECEIVERS: 'team@caracole.ph, sales@caracole.ph' }
  const app = express()
  app.use(express.json())
  app.use('/api/v1/inquiries', inquiriesRoutes({ prisma, mailer, config }))
  app.use(errorHandler)
  return { app, inquiries, confirmations, notifications, config }
}

async function withServer(run) {
  const harness = createHarness()
  const server = await new Promise((resolve) => {
    const instance = harness.app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  try {
    await run({ ...harness, request: async (body) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/inquiries`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      })
      return { status: response.status, body: await response.json() }
    } })
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

test('inquiries are stored as pending and notify the inquirer and configured admins', async () => {
  await withServer(async ({ request, inquiries, confirmations, notifications }) => {
    const result = await request({
      firstName: 'Ava', lastName: 'Santos', email: ' Ava@Example.com ', contactNumber: '+639171234567',
      inquiry: 'Could you share the availability?', productName: 'Leaf Me Alone', edpNumber: 'SIG-001'
    })

    assert.equal(result.status, 201)
    assert.equal(result.body.inquiry.status, 'PENDING')
    assert.equal(inquiries.length, 1)
    assert.equal(inquiries[0].email, 'ava@example.com')
    assert.equal(inquiries[0].productName, 'Leaf Me Alone')
    assert.equal(inquiries[0].edpNumber, 'SIG-001')
    assert.equal(confirmations.length, 1)
    assert.equal(confirmations[0].inquiry.id, 'inquiry-1')
    assert.equal(confirmations[0].inquiry.productName, 'Leaf Me Alone')
    assert.equal(confirmations[0].inquiry.edpNumber, 'SIG-001')
    assert.equal(notifications.length, 1)
    assert.deepEqual(notifications[0].recipients, ['team@caracole.ph', 'sales@caracole.ph'])
  })
})

test('inquiry recipient lists are normalized and serialized inquiries omit internal fields', () => {
  assert.deepEqual(configuredEmailRecipients(' Team@Caracole.ph,team@caracole.ph,not-an-email '), ['team@caracole.ph'])
  assert.deepEqual(inquiryRecipients({ INQUIRY_RECEIVERS: 'sales@caracole.ph' }), ['sales@caracole.ph'])
  assert.deepEqual(serializeInquiry({ id: 'inquiry-1', createdAt: new Date('2026-09-03T00:00:00.000Z'), firstName: 'Ava', lastName: 'Santos', email: 'ava@example.com', contactNumber: '+639171234567', message: 'Hello', productName: null, edpNumber: null, status: 'PENDING' }), {
    id: 'inquiry-1', createdAt: new Date('2026-09-03T00:00:00.000Z'), firstName: 'Ava', lastName: 'Santos', email: 'ava@example.com', contactNumber: '+639171234567', inquiry: 'Hello', productName: null, edpNumber: null, status: 'PENDING'
  })
})
