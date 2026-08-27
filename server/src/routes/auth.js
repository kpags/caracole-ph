import bcrypt from 'bcryptjs'
import express from 'express'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { asyncRoute, HttpError } from '../lib/http.js'
import { designerSchema, emailSchema, otpSchema, passwordSchema } from '../lib/validation.js'
import { designerData } from '../lib/users.js'

const credentialsSchema = z.object({ email: emailSchema, password: passwordSchema }).strict()

export function designerRegistrationNotificationRecipients(config) {
  return [config.SMTP_USER]
}

export function authRoutes({ prisma, config, auth, mailer }) {
  const router = express.Router()

  async function sendOtp(user, purpose, template) {
    const otp = await auth.createOtp(user.id, purpose)
    await mailer.sendOtp({ template, email: user.email, firstName: user.designer?.firstName ?? 'Administrator', otp, config })
  }

  async function notifyDesignerRegistration(user) {
    const designer = { ...user.designer, email: user.email }
    await Promise.all([
      mailer.sendDesignerRegistrationConfirmation({ designer, config }),
      mailer.sendDesignerRegistrationNotification({ designer, recipients: designerRegistrationNotificationRecipients(config), config })
    ])
  }

  router.post('/register/designer', asyncRoute(async (req, res) => {
    const body = z.object({ email: emailSchema, password: passwordSchema, designer: designerSchema }).strict().parse(req.body)
    const existing = await prisma.user.findUnique({ where: { email: body.email }, include: { designer: true } })
    if (existing?.isEmailVerified) throw new HttpError(409, 'Email is already registered')
    const password = await bcrypt.hash(body.password, config.BCRYPT_SALT_ROUNDS)
    const user = existing
      ? await prisma.user.update({ where: { id: existing.id }, data: { password, isActive: true, isEmailVerified: true, isDesigner: true, designer: { upsert: { create: designerData(body.designer), update: { ...designerData(body.designer), reviewStatus: 'PENDING', reviewedAt: null, reviewedById: null } } } }, include: { designer: true } })
      : await prisma.user.create({ data: { email: body.email, password, isActive: true, isEmailVerified: true, isDesigner: true, designer: { create: designerData(body.designer) } }, include: { designer: true } })
    await notifyDesignerRegistration(user)
    res.status(201).json({ message: 'Registration received. Check your email for a confirmation from Caracole.', user: { id: user.id, email: user.email } })
  }))

  router.post('/verify-email', asyncRoute(async (req, res) => {
    const body = z.object({ email: emailSchema, otp: otpSchema }).strict().parse(req.body)
    const user = await prisma.user.findUnique({ where: { email: body.email } })
    if (!user || !user.isActive) throw new HttpError(400, 'Invalid or expired OTP')
    await auth.verifyOtp(user.id, 'EMAIL_VERIFICATION', body.otp)
    await prisma.user.update({ where: { id: user.id }, data: { isEmailVerified: true } })
    res.json({ message: 'Email verified successfully.' })
  }))

  router.post('/resend-verification', asyncRoute(async (req, res) => {
    const { email } = z.object({ email: emailSchema }).strict().parse(req.body)
    const user = await prisma.user.findUnique({ where: { email }, include: { designer: true } })
    if (user?.isActive && !user.isEmailVerified && !user.isDesigner) await sendOtp(user, 'EMAIL_VERIFICATION', 'signup-otp')
    res.status(202).json({ message: 'If this account can be verified, a new OTP has been sent.' })
  }))

  router.post('/login', asyncRoute(async (req, res) => {
    const body = credentialsSchema.parse(req.body)
    const user = await prisma.user.findUnique({ where: { email: body.email }, include: { designer: true } })
    if (!user || !(await bcrypt.compare(body.password, user.password))) throw new HttpError(401, 'Invalid email or password')
    if (!user.isActive) throw new HttpError(403, 'This account is disabled')
    if (!user.isEmailVerified) throw new HttpError(403, 'Verify your email before logging in')
    const tokens = await auth.issueTokens(user)
    res.json({ user: { id: user.id, email: user.email, designer: user.designer, isDesigner: user.isDesigner, isStaff: user.isStaff, isSuperuser: user.isSuperuser }, ...tokens })
  }))

  router.post('/admin/login', asyncRoute(async (req, res) => {
    const body = credentialsSchema.parse(req.body)
    const user = await prisma.user.findUnique({ where: { email: body.email }, include: { designer: true } })
    if (!user || !(await bcrypt.compare(body.password, user.password))) throw new HttpError(401, 'Invalid email or password')
    if (!user.isActive) throw new HttpError(403, 'This account is disabled')
    if (!user.isEmailVerified) throw new HttpError(403, 'Verify your email before logging in')
    if (!user.isStaff && !user.isSuperuser) throw new HttpError(403, 'Administrator access is required')
    const tokens = await auth.issueTokens(user)
    res.json({ user: { id: user.id, email: user.email, isStaff: user.isStaff, isSuperuser: user.isSuperuser }, ...tokens })
  }))

  router.post('/refresh', asyncRoute(async (req, res) => {
    const { refreshToken } = z.object({ refreshToken: z.string().min(1) }).strict().parse(req.body)
    let claims
    try { claims = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET) } catch { throw new HttpError(401, 'Invalid refresh token') }
    if (claims.type !== 'refresh' || !claims.jti || !claims.sub) throw new HttpError(401, 'Invalid refresh token')
    const record = await prisma.refreshToken.findUnique({ where: { id: claims.jti }, include: { user: { include: { designer: true } } } })
    if (!record || record.revokedAt || record.expiresAt <= new Date() || !(await bcrypt.compare(refreshToken, record.tokenHash)) || !record.user.isActive || !record.user.isEmailVerified) throw new HttpError(401, 'Invalid refresh token')
    await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } })
    res.json(await auth.issueTokens(record.user))
  }))

  router.post('/logout', asyncRoute(async (req, res) => {
    const { refreshToken } = z.object({ refreshToken: z.string().min(1) }).strict().parse(req.body)
    try {
      const claims = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET)
      if (claims.type === 'refresh' && claims.jti) await prisma.refreshToken.updateMany({ where: { id: claims.jti, revokedAt: null }, data: { revokedAt: new Date() } })
    } catch { /* Logout remains idempotent for invalid or expired tokens. */ }
    res.status(204).end()
  }))

  router.post('/forgot-password', asyncRoute(async (req, res) => {
    const { email } = z.object({ email: emailSchema }).strict().parse(req.body)
    const user = await prisma.user.findUnique({ where: { email }, include: { designer: true } })
    if (user?.isActive && user.isEmailVerified) await sendOtp(user, 'PASSWORD_RESET', 'forgot-password-otp')
    res.status(202).json({ message: 'If an eligible account exists, a password-reset OTP has been sent.' })
  }))

  router.post('/reset-password', asyncRoute(async (req, res) => {
    const body = z.object({ email: emailSchema, otp: otpSchema, password: passwordSchema }).strict().parse(req.body)
    const user = await prisma.user.findUnique({ where: { email: body.email } })
    if (!user || !user.isActive) throw new HttpError(400, 'Invalid or expired OTP')
    await auth.verifyOtp(user.id, 'PASSWORD_RESET', body.otp)
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(body.password, config.BCRYPT_SALT_ROUNDS) } }),
      prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } })
    ])
    res.json({ message: 'Password reset successfully. Please log in again.' })
  }))

  router.post('/admin-invitations/complete', asyncRoute(async (req, res) => {
    const body = z.object({ token: z.string().min(1), password: passwordSchema }).strict().parse(req.body)
    let claims
    try {
      claims = jwt.verify(body.token, config.JWT_ACCESS_SECRET)
    } catch {
      throw new HttpError(400, 'This invitation link is invalid or has expired')
    }
    if (claims.type !== 'admin-invitation' || !claims.sub || !claims.email) throw new HttpError(400, 'This invitation link is invalid or has expired')

    const password = await bcrypt.hash(body.password, config.BCRYPT_SALT_ROUNDS)
    const activated = await prisma.user.updateMany({
      where: {
        id: claims.sub,
        email: claims.email,
        isActive: false,
        OR: [{ isStaff: true }, { isSuperuser: true }]
      },
      data: { password, isActive: true, isEmailVerified: true }
    })
    if (!activated.count) throw new HttpError(400, 'This invitation link is invalid, expired, or has already been used')

    await prisma.refreshToken.updateMany({ where: { userId: claims.sub, revokedAt: null }, data: { revokedAt: new Date() } })
    res.json({ message: 'Your administrator account is active. You can now sign in.' })
  }))

  return router
}
