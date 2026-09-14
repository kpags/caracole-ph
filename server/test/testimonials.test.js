import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { errorHandler } from '../src/lib/http.js'
import { testimonialsRoutes } from '../src/routes/testimonials.js'

const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']

function createHarness({ inspectMedia = async () => ({ type: 'image', width: 1920, height: 1080 }) } = {}) {
  const records = []
  const deleted = []
  const prisma = {
    testimonial: {
      async findMany({ orderBy, select } = {}) {
        const values = [...records]
        if (orderBy?.position) values.sort((a, b) => a.position - b.position)
        return select ? values.map(({ id }) => ({ id })) : values
      },
      async count() { return records.length },
      async findUnique({ where }) { return records.find((item) => item.id === where.id || item.position === where.position) || null },
      async create({ data }) {
        const testimonial = { id: ids[records.length], createdAt: new Date('2026-09-14T00:00:00.000Z'), updatedAt: new Date('2026-09-14T00:00:00.000Z'), ...data }
        records.push(testimonial)
        return testimonial
      },
      async update({ where, data }) {
        const testimonial = records.find((item) => item.id === where.id)
        Object.assign(testimonial, data)
        return testimonial
      },
      async updateMany({ where = {}, data }) {
        for (const testimonial of records) {
          if (where.position?.gt !== undefined && testimonial.position <= where.position.gt) continue
          if (data.position?.increment !== undefined) testimonial.position += data.position.increment
          if (data.position?.decrement !== undefined) testimonial.position -= data.position.decrement
        }
      },
      async delete({ where }) {
        const index = records.findIndex((item) => item.id === where.id)
        return records.splice(index, 1)[0]
      }
    },
    async $transaction(operations) { return Promise.all(operations) }
  }
  const storage = { async upload({ fileName }) { return `https://cdn.example.test/testimonials/${fileName}` }, async delete(url) { deleted.push(url) } }
  const app = express()
  app.use(express.json())
  app.use('/api/v1/testimonials', testimonialsRoutes({ prisma, storage, inspectMedia, authenticate: (_req, _res, next) => next(), authorize: () => (_req, _res, next) => next() }))
  app.use(errorHandler)
  return { app, records, deleted }
}

async function withServer(run, options) {
  const harness = createHarness(options)
  const server = await new Promise((resolve) => { const instance = harness.app.listen(0, '127.0.0.1', () => resolve(instance)) })
  try { await run({ ...harness, url: `http://127.0.0.1:${server.address().port}/api/v1/testimonials` }) } finally { await new Promise((resolve) => server.close(resolve)) }
}

function testimonialForm(position = 0) {
  const form = new FormData()
  form.append('name', 'Jose Chan')
  form.append('designation', 'Caracole PH Client')
  form.append('mainTestimony', 'Caracole transformed our home into something unmistakably ours.')
  form.append('subTestimony', 'Every silhouette and finish feels thoughtfully considered.')
  form.append('position', String(position))
  form.append('media', new Blob(['image'], { type: 'image/png' }), 'jose.png')
  return form
}

test('creates and publicly returns ordered testimonials', async () => {
  await withServer(async ({ url, records }) => {
    const create = await fetch(url, { method: 'POST', body: testimonialForm() })
    assert.equal(create.status, 201)
    assert.equal(records[0].mediaContent, 'https://cdn.example.test/testimonials/jose.png')
    const response = await fetch(url)
    const body = await response.json()
    assert.equal(response.status, 200)
    assert.equal(body.testimonials[0].name, 'Jose Chan')
    assert.equal(body.testimonials[0].position, 0)
  })
})

test('replaces media, removes old Cloudflare content, and accepts reorder', async () => {
  await withServer(async ({ url, deleted }) => {
    await fetch(url, { method: 'POST', body: testimonialForm(0) })
    await fetch(url, { method: 'POST', body: testimonialForm(1) })
    const update = await fetch(`${url}/${ids[0]}`, { method: 'PATCH', body: testimonialForm(0) })
    assert.equal(update.status, 200)
    assert.equal(deleted.length, 1)
    const reorder = await fetch(`${url}/reorder`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [ids[1], ids[0]] }) })
    assert.equal(reorder.status, 200)
    assert.deepEqual((await reorder.json()).testimonials.map((item) => item.id), [ids[1], ids[0]])
    const removal = await fetch(`${url}/${ids[1]}`, { method: 'DELETE' })
    assert.equal(removal.status, 204)
    assert.equal(deleted.length, 2)
  })
})

test('rejects oversized testimony text, invalid positions, and occupied positions', async () => {
  await withServer(async ({ url }) => {
    const oversized = testimonialForm()
    oversized.set('mainTestimony', 'x'.repeat(151))
    assert.equal((await fetch(url, { method: 'POST', body: oversized })).status, 400)

    assert.equal((await fetch(url, { method: 'POST', body: testimonialForm(10) })).status, 400)
    assert.equal((await fetch(url, { method: 'POST', body: testimonialForm(0) })).status, 201)
    assert.equal((await fetch(url, { method: 'POST', body: testimonialForm(0) })).status, 409)
  })
})

test('rejects a video whose verified duration exceeds ten seconds', async () => {
  await withServer(async ({ url, records }) => {
    const response = await fetch(url, { method: 'POST', body: testimonialForm() })
    assert.equal(response.status, 400)
    assert.match((await response.json()).message, /10 seconds/)
    assert.equal(records.length, 0)
  }, { inspectMedia: async () => ({ type: 'video', width: 1920, height: 1080, duration: 10.1 }) })
})
