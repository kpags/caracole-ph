import test from 'node:test'
import assert from 'node:assert/strict'
import { heroBannerCreateSchema, heroBannerUpdateSchema } from '../src/lib/validation.js'

const validHeroBanner = {
  title: 'A room should move you.',
  subtitle: 'The Art of Living',
  description: 'Sculptural silhouettes and tactile comfort.',
  category: 'Living',
  position: 0
}

test('accepts valid hero banner content and normalizes an empty subtitle', () => {
  assert.equal(heroBannerCreateSchema.parse({ ...validHeroBanner, subtitle: '' }).subtitle, null)
  assert.equal(heroBannerCreateSchema.parse({ ...validHeroBanner, position: '2' }).position, 2)
})

test('rejects oversized fields and empty updates', () => {
  assert.equal(heroBannerCreateSchema.safeParse({ ...validHeroBanner, title: 'x'.repeat(81) }).success, false)
  assert.equal(heroBannerCreateSchema.safeParse({ ...validHeroBanner, position: 3 }).success, false)
  assert.equal(heroBannerUpdateSchema.safeParse({}).success, false)
})
