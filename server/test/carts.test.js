import test from 'node:test'
import assert from 'node:assert/strict'
import { cartItems, cartListWhere, cartStatus, serializeCart } from '../src/routes/carts.js'
import { abandonInactiveCarts, abandonedCartCutoff } from '../src/lib/cart-abandonment.js'

const now = new Date('2026-09-01T00:00:00.000Z')
const baseCart = {
  id: '2e660f0b-b51f-4787-a9f3-496b0c316a20',
  createdAt: new Date('2026-08-30T10:00:00.000Z'),
  updatedAt: new Date('2026-08-31T12:00:00.000Z'),
  sessionId: '3d7b9185-a0d2-4e98-9f39-e30134234176',
  customerEmail: 'customer@example.com',
  customerFirstName: 'Ava',
  customerLastName: 'Reyes',
  itemCount: 2,
  totalPrice: '2300.00',
  currencyCode: 'PHP'
}

test('cart summaries calculate price and distinguish active from abandoned carts', () => {
  const items = cartItems([{ id: 'chair', handle: 'chair', edpNumber: 'EDP-1', name: 'Chair', image: null, priceValue: 1150, quantity: 2 }])
  assert.deepEqual(items, [{ id: 'chair', handle: 'chair', edpNumber: 'EDP-1', name: 'Chair', image: null, priceValue: 1150, quantity: 2, totalPrice: 2300 }])
  assert.equal(cartStatus(baseCart.updatedAt, now), 'Active')
  assert.equal(cartStatus(new Date('2026-08-25T00:00:00.000Z'), now), 'Abandoned')
  assert.deepEqual(serializeCart(baseCart, now), {
    id: baseCart.id,
    createdAt: baseCart.createdAt,
    updatedAt: baseCart.updatedAt,
    sessionId: baseCart.sessionId,
    email: 'customer@example.com',
    firstName: 'Ava',
    lastName: 'Reyes',
    name: 'Ava Reyes',
    itemCount: 2,
    totalPrice: 2300,
    currencyCode: 'PHP',
    status: 'Active'
  })
})

test('registered and session cart filters are indexed around their owner fields and creation date', () => {
  const registered = cartListWhere('REGISTERED', { search: 'ava', dateFrom: '2026-08-01', dateTo: '2026-08-31' })
  assert.equal(registered.ownerType, 'REGISTERED')
  assert.deepEqual(registered.itemCount, { gt: 0 })
  assert.equal(registered.OR.length, 3)
  assert.equal(registered.createdAt.gte.toISOString(), '2026-08-01T00:00:00.000Z')
  assert.equal(registered.createdAt.lte.toISOString(), '2026-08-31T23:59:59.999Z')
  const session = cartListWhere('SESSION', { search: 'abc' })
  assert.deepEqual(session.sessionId, { contains: 'abc', mode: 'insensitive' })
})

test('abandonment cleanup changes only active carts inactive for seven days', async () => {
  const calls = []
  const now = new Date('2026-09-01T06:00:00.000Z')
  const result = await abandonInactiveCarts({ cart: { updateMany: async (input) => { calls.push(input); return { count: 3 } } } }, { now, logger: { log() {} } })
  assert.equal(abandonedCartCutoff(now).toISOString(), '2026-08-25T06:00:00.000Z')
  assert.equal(result.count, 3)
  assert.deepEqual(calls[0], {
    where: { status: 'ACTIVE', itemCount: { gt: 0 }, updatedAt: { lte: new Date('2026-08-25T06:00:00.000Z') } },
    data: { status: 'ABANDONED' }
  })
})
