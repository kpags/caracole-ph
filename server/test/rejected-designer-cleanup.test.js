import test from 'node:test'
import assert from 'node:assert/strict'
import { configuredEmailRecipients } from '../src/lib/email-recipients.js'
import { purgeRejectedDesigners, rejectedDesignerPurgeCutoff } from '../src/lib/rejected-designer-cleanup.js'

test('legacy environment recipients can be normalized only for the one-time database seed', () => {
  assert.deepEqual(configuredEmailRecipients('Design@Caracole.ph, design@caracole.ph, invalid-value'), ['design@caracole.ph'])
})

test('rejected designers become eligible on the fifteenth calendar day in Manila', () => {
  const cutoff = rejectedDesignerPurgeCutoff(new Date('2026-08-16T00:10:00+08:00'))
  assert.equal(cutoff.toISOString(), '2026-08-01T16:00:00.000Z')
})

test('cleanup deletes only rejected designer users before the eligibility cutoff and remains idempotent', async () => {
  const calls = []
  const logs = []
  const prisma = { user: { deleteMany: async (args) => { calls.push(args); return { count: calls.length === 1 ? 2 : 0 } } } }
  const options = { now: new Date('2026-08-16T00:10:00+08:00'), logger: { log: (message) => logs.push(message) } }

  const first = await purgeRejectedDesigners(prisma, options)
  const second = await purgeRejectedDesigners(prisma, options)

  assert.equal(first.deletedCount, 2)
  assert.equal(second.deletedCount, 0)
  assert.equal(calls[0].where.isDesigner, true)
  assert.equal(calls[0].where.designer.is.reviewStatus, 'REJECTED')
  assert.equal(calls[0].where.designer.is.reviewedAt.lt.toISOString(), '2026-08-01T16:00:00.000Z')
  assert.equal(logs.some((message) => message.includes('account(s) deleted')), true)
})
