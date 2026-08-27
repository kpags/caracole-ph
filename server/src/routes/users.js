import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import express from 'express'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { asyncRoute, HttpError } from '../lib/http.js'
import { designerData, userSelect } from '../lib/users.js'
import { designerUpdateSchema } from '../lib/validation.js'

const adminListQuery = z.object({
  search: z.string().trim().min(1).max(120).optional(),
  role: z.enum(['staff', 'superuser']).optional()
})

const reviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED'])
}).strict()

const adminInvitationSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(320),
  role: z.enum(['staff', 'superuser'])
}).strict()

export function createAdminInvitationToken(user, config) {
  return jwt.sign(
    { sub: user.id, email: user.email, type: 'admin-invitation' },
    config.JWT_ACCESS_SECRET,
    { expiresIn: config.ADMIN_INVITATION_EXPIRES_IN }
  )
}

export function adminRoleFor(user) {
  if (user.isSuperuser) return 'Superuser'
  if (user.isStaff) return 'Staff'
  return '--'
}

export function serializeAdminUser(user) {
  const firstName = user.firstName?.trim() || user.designer?.firstName?.trim() || ''
  const lastName = user.lastName?.trim() || user.designer?.lastName?.trim() || ''
  return {
    id: user.id,
    email: user.email,
    name: [firstName, lastName].filter(Boolean).join(' ') || '--',
    role: adminRoleFor(user),
    active: user.isActive
  }
}

export function serializeDesignerUser(user) {
  const designer = user.designer
  return {
    id: user.id,
    email: user.email,
    name: [designer?.firstName, designer?.lastName].filter(Boolean).join(' ') || '--',
    mobileNumber: designer?.mobileNumber || '--',
    firstName: designer?.firstName || '',
    lastName: designer?.lastName || '',
    birthdate: designer?.birthdate || null,
    company: designer?.company || null,
    officeAddress: designer?.officeAddress || null,
    companyWebsite: designer?.companyWebsite || null,
    touchpoint: designer?.touchpoint || '',
    howDidYouHearAboutUs: designer?.howDidYouHearAboutUs || '',
    reviewStatus: designer?.reviewStatus || 'PENDING',
    reviewedAt: designer?.reviewedAt || null,
    reviewedBy: designer?.reviewedBy || null,
    emailVerified: user.isEmailVerified,
    active: user.isActive
  }
}

export function visibleStaffWhere(isSuperuser) {
  return {
    OR: [{ isStaff: true }, { isSuperuser: true }],
    ...(isSuperuser ? {} : { isSuperuser: false })
  }
}

export function matchesNameOrEmail(user, search) {
  if (!search) return true
  const query = search.toLocaleLowerCase()
  return [user.email, user.designer?.firstName, user.designer?.lastName]
    .filter(Boolean)
    .some((value) => value.toLocaleLowerCase().includes(query))
}

export function usersRoutes({ prisma, config, mailer, authenticate, authorize }) {
  const router = express.Router()
  router.use(authenticate)

  router.get('/me', asyncRoute(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: userSelect })
    if (!user) throw new HttpError(404, 'User not found')
    res.json({ user })
  }))

  router.patch('/me', asyncRoute(async (req, res) => {
    const designer = designerUpdateSchema.parse(req.body)
    if (!req.user.isDesigner) throw new HttpError(403, 'Only designer accounts have designer details')
    const user = await prisma.user.update({ where: { id: req.user.id }, data: { designer: { update: designerData(designer) } }, select: userSelect })
    res.json({ user })
  }))

  router.get('/admins', authorize('staff'), asyncRoute(async (req, res) => {
    const query = adminListQuery.parse(req.query)
    const users = await prisma.user.findMany({ where: visibleStaffWhere(req.user.isSuperuser), select: userSelect, orderBy: { createdAt: 'desc' } })
    const visible = users.filter((user) => matchesNameOrEmail(user, query.search) && (!query.role || adminRoleFor(user).toLocaleLowerCase() === query.role))
    res.json({ users: visible.map(serializeAdminUser) })
  }))

  router.post('/admin-invitations', authorize('superuser'), asyncRoute(async (req, res) => {
    const body = adminInvitationSchema.parse(req.body)
    const existing = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } })
    if (existing) throw new HttpError(409, 'An account with this email already exists')

    const user = await prisma.user.create({
      data: {
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
        password: await bcrypt.hash(crypto.randomBytes(32).toString('base64url'), config.BCRYPT_SALT_ROUNDS),
        isStaff: body.role === 'staff',
        isSuperuser: body.role === 'superuser',
        isActive: false,
        isEmailVerified: false
      },
      select: userSelect
    })

    try {
      await mailer.sendAdminInvitation({ user, token: createAdminInvitationToken(user, config), config })
    } catch (error) {
      await prisma.user.delete({ where: { id: user.id } })
      throw error
    }

    res.status(201).json({ message: `An invitation was sent to ${user.email}.`, user: serializeAdminUser(user) })
  }))

  router.get('/designers', authorize('staff'), asyncRoute(async (_req, res) => {
    const users = await prisma.user.findMany({
      where: { isActive: true, isDesigner: true, designer: { isNot: null } },
      select: userSelect,
      orderBy: { createdAt: 'desc' }
    })
    res.json({ designers: users.map(serializeDesignerUser) })
  }))

  router.get('/designers/:id', authorize('staff'), asyncRoute(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id)
    const user = await prisma.user.findFirst({ where: { id, isActive: true, isDesigner: true, designer: { isNot: null } }, select: userSelect })
    if (!user) throw new HttpError(404, 'Designer not found')
    res.json({ designer: serializeDesignerUser(user) })
  }))

  router.patch('/designers/:id/review', authorize('staff'), asyncRoute(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id)
    const { status } = reviewSchema.parse(req.body)
    const user = await prisma.user.findFirst({ where: { id, isActive: true, isDesigner: true, designer: { isNot: null } }, select: { id: true } })
    if (!user) throw new HttpError(404, 'Designer not found')
    const designer = await prisma.designer.update({
      where: { userId: id },
      data: { reviewStatus: status, reviewedAt: new Date(), reviewedById: req.user.id },
      include: { user: { select: { id: true, email: true, isActive: true, isEmailVerified: true } }, reviewedBy: { select: { id: true, email: true } } }
    })
    await mailer.sendDesignerReviewDecision({ designer: { ...designer, email: designer.user.email }, status, config })
    res.json({ designer: serializeDesignerUser({ ...designer.user, designer }) })
  }))

  router.get('/', authorize('staff'), asyncRoute(async (req, res) => {
    const users = await prisma.user.findMany({ where: visibleStaffWhere(req.user.isSuperuser), select: userSelect, orderBy: { createdAt: 'desc' } })
    res.json({ users })
  }))

  router.get('/:id', authorize('staff'), asyncRoute(async (req, res) => {
    const user = await prisma.user.findFirst({ where: { id: req.params.id, ...visibleStaffWhere(req.user.isSuperuser) }, select: userSelect })
    if (!user) throw new HttpError(404, 'User not found')
    res.json({ user })
  }))

  router.patch('/:id', authorize('superuser'), asyncRoute(async (req, res) => {
    const body = z.object({ isDesigner: z.boolean().optional(), isStaff: z.boolean().optional(), isSuperuser: z.boolean().optional(), isActive: z.boolean().optional() }).strict().refine((value) => Object.keys(value).length > 0, 'Provide at least one account field').parse(req.body)
    const user = await prisma.user.update({ where: { id: req.params.id }, data: body, select: userSelect })
    res.json({ user })
  }))

  return router
}
