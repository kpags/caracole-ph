import test from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { adminRoleFor, createAdminInvitationToken, matchesNameOrEmail, serializeAdminUser, serializeDesignerUser, visibleStaffWhere } from '../src/routes/users.js'

const designer = {
  id: 'f023ceec-77a3-4324-85c7-39ecbc747fad',
  email: 'maria@example.com',
  isActive: true,
  isEmailVerified: true,
  isStaff: false,
  isSuperuser: false,
  designer: {
    firstName: 'Maria',
    lastName: 'Santos',
    mobileNumber: '+639171234567',
    birthdate: new Date('1990-01-01'),
    company: 'Caracole Studio',
    officeAddress: null,
    companyWebsite: null,
    touchpoint: 'Trade show',
    howDidYouHearAboutUs: 'Colleague',
    reviewStatus: 'PENDING',
    reviewedAt: null,
    reviewedBy: null
  }
}

test('serializes admin names and gives superuser precedence over staff', () => {
  assert.equal(adminRoleFor({ isStaff: true, isSuperuser: true }), 'Superuser')
  assert.deepEqual(serializeAdminUser({ ...designer, isStaff: true, isSuperuser: false }), {
    id: designer.id, email: designer.email, name: 'Maria Santos', role: 'Staff', active: true
  })
})

test('serializes complete designer details without authentication secrets', () => {
  const result = serializeDesignerUser(designer)
  assert.equal(result.name, 'Maria Santos')
  assert.equal(result.mobileNumber, '+639171234567')
  assert.equal(result.reviewStatus, 'PENDING')
  assert.equal('password' in result, false)
  assert.equal('refreshTokens' in result, false)
})

test('staff visibility excludes superusers while superusers can see both roles', () => {
  assert.equal(visibleStaffWhere(false).isSuperuser, false)
  assert.equal(visibleStaffWhere(true).isSuperuser, undefined)
  assert.equal('isActive' in visibleStaffWhere(true), false)
  assert.equal(matchesNameOrEmail(designer, 'santos'), true)
  assert.equal(matchesNameOrEmail(designer, 'maria@example.com'), true)
  assert.equal(matchesNameOrEmail(designer, 'not-found'), false)
})

test('serializes invited administrator names and signs a scoped invitation token', () => {
  const invited = { ...designer, firstName: 'Ava', lastName: 'Reyes', isStaff: true, isSuperuser: false }
  assert.equal(serializeAdminUser(invited).name, 'Ava Reyes')
  const config = { JWT_ACCESS_SECRET: 'a-secure-test-secret-that-is-long-enough', ADMIN_INVITATION_EXPIRES_IN: '1h' }
  const token = createAdminInvitationToken(invited, config)
  const claims = jwt.verify(token, config.JWT_ACCESS_SECRET)
  assert.equal(claims.sub, invited.id)
  assert.equal(claims.type, 'admin-invitation')
  assert.equal(claims.email, invited.email)
})
