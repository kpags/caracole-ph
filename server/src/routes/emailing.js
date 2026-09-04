import express from 'express'
import { z } from 'zod'
import {
  EMAIL_NOTIFICATION_EVENTS,
  emailNotificationEventSchema,
  hasEmailNotificationRecipients,
  normalizeRecipientGroups,
  serializeEmailNotificationRecipients
} from '../lib/email-recipients.js'
import { asyncRoute, HttpError } from '../lib/http.js'

const recipientsSchema = z.object({
  to: z.array(z.string()).max(100).default([]),
  cc: z.array(z.string()).max(100).default([]),
  bcc: z.array(z.string()).max(100).default([])
}).strict()

function emptyConfiguration(event) {
  return { event, to: [], cc: [], bcc: [], updatedAt: null }
}

export function emailingRoutes({ prisma, config, mailer, authenticate, authorize }) {
  const router = express.Router()
  router.use(authenticate, authorize('staff'))

  router.get('/recipients', asyncRoute(async (_req, res) => {
    const saved = await prisma.emailNotificationRecipient.findMany()
    const byEvent = new Map(saved.map((configuration) => [configuration.event, configuration]))
    res.json({ recipients: EMAIL_NOTIFICATION_EVENTS.map((event) => byEvent.has(event) ? serializeEmailNotificationRecipients(byEvent.get(event)) : emptyConfiguration(event)) })
  }))

  router.get('/recipients/:event', asyncRoute(async (req, res) => {
    const event = emailNotificationEventSchema.parse(req.params.event)
    const saved = await prisma.emailNotificationRecipient.findUnique({ where: { event } })
    res.json({ recipients: saved ? serializeEmailNotificationRecipients(saved) : emptyConfiguration(event) })
  }))

  router.put('/recipients/:event', asyncRoute(async (req, res) => {
    const event = emailNotificationEventSchema.parse(req.params.event)
    const recipients = normalizeRecipientGroups(recipientsSchema.parse(req.body))
    const saved = await prisma.emailNotificationRecipient.upsert({
      where: { event },
      create: { event, toRecipients: recipients.to, ccRecipients: recipients.cc, bccRecipients: recipients.bcc },
      update: { toRecipients: recipients.to, ccRecipients: recipients.cc, bccRecipients: recipients.bcc }
    })
    res.json({ message: 'Email recipients saved.', recipients: serializeEmailNotificationRecipients(saved) })
  }))

  router.post('/recipients/:event/test', asyncRoute(async (req, res) => {
    const event = emailNotificationEventSchema.parse(req.params.event)
    const recipients = normalizeRecipientGroups(recipientsSchema.parse(req.body))
    if (!hasEmailNotificationRecipients(recipients)) throw new HttpError(422, 'Add at least one recipient before sending a test email')

    await mailer.sendEmailNotificationTest({ event, recipients, testerEmail: req.user.email, config })
    res.json({ message: 'Test email sent to the current recipient list.' })
  }))

  return router
}
