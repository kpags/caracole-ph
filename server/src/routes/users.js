import express from 'express'
import { z } from 'zod'
import { asyncRoute, HttpError } from '../lib/http.js'
import { designerData, userSelect } from '../lib/users.js'
import { designerUpdateSchema } from '../lib/validation.js'

export function usersRoutes({ prisma, authenticate, authorize }) {
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

  router.get('/', authorize('staff'), asyncRoute(async (_req, res) => {
    const users = await prisma.user.findMany({ where: { isActive: true }, select: userSelect, orderBy: { createdAt: 'desc' } })
    res.json({ users })
  }))

  router.get('/:id', authorize('staff'), asyncRoute(async (req, res) => {
    const user = await prisma.user.findFirst({ where: { id: req.params.id, isActive: true }, select: userSelect })
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
