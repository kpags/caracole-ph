import test from 'node:test'
import assert from 'node:assert/strict'
import { inspectTestimonialImage, validateTestimonialMediaDetails } from '../src/lib/testimonial-media.js'

function png(width, height) {
  const buffer = Buffer.alloc(24)
  buffer.write('89504e470d0a1a0a', 0, 'hex')
  buffer.writeUInt32BE(width, 16)
  buffer.writeUInt32BE(height, 20)
  return buffer
}

test('reads PNG dimensions and accepts a compliant 16:9 testimonial image', () => {
  assert.deepEqual(inspectTestimonialImage(png(1920, 1080), 'image/png'), { width: 1920, height: 1080 })
  assert.doesNotThrow(() => validateTestimonialMediaDetails({ type: 'image', width: 1920, height: 1080 }))
})

test('rejects undersized, non-16:9, and overlong testimonial media', () => {
  assert.throws(() => validateTestimonialMediaDetails({ type: 'image', width: 1600, height: 900 }), /1920/)
  assert.throws(() => validateTestimonialMediaDetails({ type: 'image', width: 1920, height: 1200 }), /16:9/)
  assert.throws(() => validateTestimonialMediaDetails({ type: 'video', width: 1920, height: 1080, duration: 10.01 }), /10 seconds/)
})
