import express from 'express'
import { z } from 'zod'
import { asyncRoute, HttpError } from '../lib/http.js'
import { emailSchema } from '../lib/validation.js'

const newsletterSubscriptionSchema = z.object({ email: emailSchema }).strict()
const newsletterListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10)
})

export function serializeNewsletterSubscriber(subscriber) {
  return { id: subscriber.id, email: subscriber.email, createdAt: subscriber.createdAt }
}

export function newsletterRoutes({ prisma, mailer, config, authenticate, authorize }) {
  const router = express.Router()

  router.post('/subscriptions', asyncRoute(async (req, res) => {
    const { email } = newsletterSubscriptionSchema.parse(req.body)
    let subscriber
    try {
      subscriber = await prisma.newsletterSubscriber.create({ data: { email } })
    } catch (error) {
      if (error?.code === 'P2002') throw new HttpError(409, 'This email address is already subscribed.')
      throw error
    }

    try {
      await mailer.sendNewsletterSubscriptionConfirmation({ email: subscriber.email, config })
    } catch (error) {
      console.error('Newsletter confirmation email failed', error)
      await prisma.newsletterSubscriber.delete({ where: { id: subscriber.id } }).catch(() => {})
      throw new HttpError(502, 'We could not complete your newsletter subscription. Please try again.')
    }

    res.status(201).json({ message: 'Thank you for subscribing to our newsletter.', subscriber: serializeNewsletterSubscriber(subscriber) })
  }))

  router.get('/subscriptions', authenticate, authorize('staff'), asyncRoute(async (req, res) => {
    const { page, limit } = newsletterListQuery.parse(req.query)
    const [totalItems, subscribers] = await prisma.$transaction([
      prisma.newsletterSubscriber.count(),
      prisma.newsletterSubscriber.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit })
    ])
    res.json({
      subscribers: subscribers.map(serializeNewsletterSubscriber),
      pagination: { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) }
    })
  }))

  return router
}
