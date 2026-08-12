import test from 'node:test'
import assert from 'node:assert/strict'
import { designerSchema } from '../src/lib/validation.js'

const validDesigner = {
  firstName: 'Maria', lastName: 'Santos', mobileNumber: '+639171234567',
  birthdate: '1990-01-01', company: null, officeAddress: null, companyWebsite: null,
  touchpoint: 'Trade event', howDidYouHearAboutUs: 'A colleague'
}

test('accepts the required designer fields and Philippine mobile format', () => {
  assert.equal(designerSchema.parse(validDesigner).mobileNumber, '+639171234567')
})

test('rejects an invalid mobile number or missing designer intake fields', () => {
  assert.equal(designerSchema.safeParse({ ...validDesigner, mobileNumber: '09171234567' }).success, false)
  assert.equal(designerSchema.safeParse({ ...validDesigner, touchpoint: '' }).success, false)
})
