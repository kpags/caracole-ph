import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { errorHandler } from '../src/lib/http.js'
import { newsletterRoutes, serializeNewsletterSubscriber } from '../src/routes/newsletter.js'

function createHarness() {
  const subscribers = []
  const sentConfirmations = []
  const prisma = {
    newsletterSubscriber: {
      async create({ data }) {
        if (subscribers.some((subscriber) => subscriber.email === data.email)) {
          const error = new Error('Unique constraint failed')
          error.code = 'P2002'
          throw error
        }
        const subscriber = { id: `subscriber-${subscribers.length + 1}`, email: data.email, createdAt: new Date('2026-09-02T00:00:00.000Z') }
        subscribers.push(subscriber)
        return subscriber
      },
      async count() { return subscribers.length },
      async findMany({ skip, take }) { return [...subscribers].reverse().slice(skip, skip + take) }
    },
    async $transaction(operations) {
      return Promise.all(operations)
    }
  }
  const app = express()
  app.use(express.json())
  const mailer = { async sendNewsletterSubscriptionConfirmation(payload) { sentConfirmations.push(payload) } }
  app.use('/api/v1/newsletter', newsletterRoutes({ prisma, mailer, config: { APP_NAME: 'Caracole PH' }, authenticate: (_req, _res, next) => next(), authorize: () => (_req, _res, next) => next() }))
  app.use(errorHandler)
  return { app, subscribers, sentConfirmations }
}

async function withServer(run) {
  const harness = createHarness()
  const server = await new Promise((resolve) => {
    const instance = harness.app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  try {
    await run({ ...harness, request: async (body) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/newsletter/subscriptions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      return { status: response.status, body: await response.json() }
    }, list: async (page = 1) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/newsletter/subscriptions?page=${page}&limit=10`)
      return { status: response.status, body: await response.json() }
    } })
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

test('newsletter subscriptions normalize emails, send confirmation, and reject duplicates', async () => {
  await withServer(async ({ request, subscribers, sentConfirmations }) => {
    const result = await request({ email: '  Ava@Example.com ' })
    assert.equal(result.status, 201)
    assert.equal(result.body.subscriber.email, 'ava@example.com')
    assert.equal(subscribers.length, 1)
    assert.equal(sentConfirmations.length, 1)
    assert.equal(sentConfirmations[0].email, 'ava@example.com')

    const duplicate = await request({ email: 'ava@example.com' })
    assert.equal(duplicate.status, 409)
    assert.equal(duplicate.body.message, 'This email address is already subscribed.')
  })
})

test('newsletter serialization exposes only public subscription fields', () => {
  assert.deepEqual(serializeNewsletterSubscriber({ id: 'subscriber-1', email: 'ava@example.com', createdAt: new Date('2026-09-02T00:00:00.000Z') }), {
    id: 'subscriber-1', email: 'ava@example.com', createdAt: new Date('2026-09-02T00:00:00.000Z')
  })
})

test('newsletter administration returns ten newest subscribers per page', async () => {
  await withServer(async ({ subscribers, list }) => {
    for (let index = 0; index < 11; index += 1) subscribers.push({ id: `subscriber-${index}`, email: `subscriber-${index}@example.com`, createdAt: new Date(`2026-09-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`) })
    const firstPage = await list()
    assert.equal(firstPage.status, 200)
    assert.equal(firstPage.body.subscribers.length, 10)
    assert.equal(firstPage.body.subscribers[0].email, 'subscriber-10@example.com')
    assert.deepEqual(firstPage.body.pagination, { page: 1, limit: 10, totalItems: 11, totalPages: 2 })

    const secondPage = await list(2)
    assert.equal(secondPage.body.subscribers.length, 1)
    assert.equal(secondPage.body.subscribers[0].email, 'subscriber-0@example.com')
  })
})
