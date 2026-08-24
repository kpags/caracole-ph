import cors from 'cors'
import express from 'express'
import jwt from 'jsonwebtoken'
import { authRoutes } from './routes/auth.js'
import { heroBannersRoutes } from './routes/hero-banners.js'
import { shopTheLookRoutes } from './routes/shop-the-look.js'
import { usersRoutes } from './routes/users.js'
import { productsRoutes } from './routes/products.js'
import { adminProductsRoutes } from './routes/admin-products.js'
import { asyncRoute, errorHandler, HttpError } from './lib/http.js'

export function createApp({ prisma, config, auth, mailer, storage, products }) {
  const app = express()
  app.disable('x-powered-by')
  app.use(cors({ origin: config.CORS_ORIGIN.split(',').map((origin) => origin.trim()), credentials: true }))
  app.use(express.json({ limit: '100kb' }))

  const authenticate = asyncRoute(async (req, _res, next) => {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
    if (!token) throw new HttpError(401, 'Authentication is required')
    try {
      const claims = jwt.verify(token, config.JWT_ACCESS_SECRET)
      if (claims.type !== 'access' || !claims.sub) throw new Error('Wrong token type')
      const user = await prisma.user.findUnique({ where: { id: claims.sub }, select: { id: true, isActive: true, isStaff: true, isSuperuser: true } })
      if (!user?.isActive) throw new HttpError(401, 'Authentication is required')
      req.user = user
      next()
    } catch (error) {
      if (error instanceof HttpError) throw error
      throw new HttpError(401, 'Authentication is required')
    }
  })
  const authorize = (role) => (req, _res, next) => {
    if (role === 'staff' && (req.user.isStaff || req.user.isSuperuser)) return next()
    if (role === 'superuser' && req.user.isSuperuser) return next()
    return next(new HttpError(403, 'You do not have permission to perform this action'))
  }

  app.get('/health', asyncRoute(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok' })
  }))
  app.use('/api/v1/auth', authRoutes({ prisma, config, auth, mailer }))
  app.use('/api/v1/hero-banners', heroBannersRoutes({ prisma, storage, authenticate, authorize }))
  app.use('/api/v1/shop-the-look', shopTheLookRoutes({ prisma, storage, authenticate, authorize }))
  app.use('/api/v1/users', usersRoutes({ prisma, authenticate, authorize }))
  app.use('/api/v1/admin/products', adminProductsRoutes({ prisma, authenticate, authorize }))
  app.use('/api/v1/products', productsRoutes({ prisma }))
  app.use((_req, _res, next) => next(new HttpError(404, 'Route not found')))
  app.use(errorHandler)
  return app
}
