import test from 'node:test'
import assert from 'node:assert/strict'
import { pendingCustomerPurgeCutoff, purgePendingCustomers } from '../src/lib/pending-customer-cleanup.js'

test('pending customers become eligible on the seventh Manila calendar day', () => {
  const cutoff = pendingCustomerPurgeCutoff(new Date('2026-09-07T06:00:00+08:00'))
  assert.equal(cutoff.toISOString(), '2026-08-31T16:00:00.000Z')
})

test('cleanup deletes only pending standard customers before the cutoff and remains idempotent', async () => {
  const calls = []
  const logs = []
  const prisma = { user: { deleteMany: async (args) => { calls.push(args); return { count: calls.length === 1 ? 2 : 0 } } } }
  const options = { now: new Date('2026-09-07T06:00:00+08:00'), logger: { log: (message) => logs.push(message) } }

  const first = await purgePendingCustomers(prisma, options)
  const second = await purgePendingCustomers(prisma, options)

  assert.equal(first.deletedCount, 2)
  assert.equal(second.deletedCount, 0)
  assert.deepEqual(calls[0].where, {
    isActive: false,
    isEmailVerified: false,
    isDesigner: false,
    isStaff: false,
    isSuperuser: false,
    OR: [{ customer: { is: null } }, { customer: { is: { source: 'WEBSITE' } } }],
    createdAt: { lt: new Date('2026-08-31T16:00:00.000Z') }
  })
  assert.equal(logs.some((message) => message.includes('2 account(s) deleted')), true)
})
