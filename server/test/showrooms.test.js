import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { errorHandler } from '../src/lib/http.js'
import { showroomsRoutes } from '../src/routes/showrooms.js'

function createHarness() {
  const branches = []
  let imageId = 0
  const prisma = {
    showroomBranch: {
      async findMany() { return [...branches].sort((left, right) => left.position - right.position) },
      async findFirst() { return branches.length ? [...branches].sort((left, right) => right.position - left.position)[0] : null },
      async findUnique({ where }) {
        return branches.find((branch) => (where.id && branch.id === where.id) || (where.name && branch.name === where.name) || (where.slug && branch.slug === where.slug)) || null
      },
      async create({ data }) {
        const branch = {
          id: `branch-${branches.length + 1}`, createdAt: new Date('2026-09-03T00:00:00.000Z'), updatedAt: new Date('2026-09-03T00:00:00.000Z'),
          name: data.name, slug: data.slug, address: data.address, contactNumbers: data.contactNumbers, position: data.position,
          images: data.images.create.map((image) => ({ id: `image-${++imageId}`, ...image })),
          schedules: data.schedules.create.map((schedule) => ({ id: `schedule-${schedule.position}`, ...schedule }))
        }
        branches.push(branch)
        return branch
      },
      async delete({ where }) {
        const index = branches.findIndex((branch) => branch.id === where.id)
        return branches.splice(index, 1)[0]
      }
    }
  }
  const deleted = []
  const storage = {
    async upload({ prefix, fileName }) { return `https://media.example.test/${prefix}/${fileName}` },
    async delete(url) { deleted.push(url) },
    resolveObjectKey(url) { return new URL(url).pathname.slice(1) },
    async rename(url, destination) { return `https://media.example.test/${destination}` }
  }
  const app = express()
  app.use('/api/v1/showrooms', showroomsRoutes({ prisma, storage, authenticate: (_req, _res, next) => next(), authorize: () => (_req, _res, next) => next() }))
  app.use(errorHandler)
  return { app, branches, deleted }
}

async function withServer(run) {
  const harness = createHarness()
  const server = await new Promise((resolve) => {
    const instance = harness.app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  try {
    await run({ ...harness, url: `http://127.0.0.1:${server.address().port}/api/v1/showrooms` })
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

function showroomForm({ includeImage = true, contacts = ['(02) 8682-0074'] } = {}) {
  const form = new FormData()
  form.append('name', 'GH Mall, San Juan')
  form.append('address', '4F GH Mall, Ortigas Avenue, San Juan City, Philippines')
  form.append('contactNumbers', JSON.stringify(contacts))
  form.append('schedules', JSON.stringify([{ dayStart: 0, dayEnd: 3, timeOpen: '10:00', timeClose: '21:00' }]))
  if (includeImage) form.append('image0', new Blob(['image'], { type: 'image/jpeg' }), 'showroom.jpg')
  return form
}

test('showroom creation stores ordered images and public output formats schedules', async () => {
  await withServer(async ({ url, branches }) => {
    const create = await fetch(url, { method: 'POST', body: showroomForm() })
    const created = await create.json()
    assert.equal(create.status, 201)
    assert.equal(branches.length, 1)
    assert.equal(created.branch.images[0].position, 0)
    assert.equal(created.branch.schedules[0].dayStartLabel, 'Mon')

    const publicResponse = await fetch(`${url}/public`)
    const publicBody = await publicResponse.json()
    assert.equal(publicResponse.status, 200)
    assert.equal(publicBody.branches[0].name, 'GH Mall, San Juan')
    assert.equal(publicBody.branches[0].schedules[0].dayEndLabel, 'Thu')
  })
})

test('showroom creation requires an image and limits contact numbers', async () => {
  await withServer(async ({ url }) => {
    const noImage = await fetch(url, { method: 'POST', body: showroomForm({ includeImage: false }) })
    assert.equal(noImage.status, 400)
    assert.match((await noImage.json()).message, /at least one showroom image/i)

    const tooManyContacts = await fetch(url, { method: 'POST', body: showroomForm({ contacts: ['1', '2', '3'] }) })
    assert.equal(tooManyContacts.status, 400)
  })
})
