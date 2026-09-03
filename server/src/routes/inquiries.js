import express from 'express'
import { z } from 'zod'
import { asyncRoute } from '../lib/http.js'
import { emailSchema } from '../lib/validation.js'

export const inquirySubmissionSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: emailSchema,
  contactNumber: z.string().trim().min(1).max(60),
  inquiry: z.string().trim().min(1).max(10_000),
  productName: z.string().trim().min(1).max(255).optional(),
  edpNumber: z.string().trim().min(1).max(120).optional()
}).strict()

export function configuredEmailRecipients(value) {
  return [...new Set(String(value || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => z.string().email().safeParse(email).success))]
}

export function inquiryRecipients(config) {
  return configuredEmailRecipients(config.INQUIRY_RECEIVERS)
}

export function serializeInquiry(inquiry) {
  return {
    id: inquiry.id,
    createdAt: inquiry.createdAt,
    firstName: inquiry.firstName,
    lastName: inquiry.lastName,
    email: inquiry.email,
    contactNumber: inquiry.contactNumber,
    inquiry: inquiry.message,
    productName: inquiry.productName,
    edpNumber: inquiry.edpNumber,
    status: inquiry.status
  }
}

export function inquiriesRoutes({ prisma, config, mailer }) {
  const router = express.Router()

  router.post('/', asyncRoute(async (req, res) => {
    const body = inquirySubmissionSchema.parse(req.body)
    const inquiry = await prisma.inquiry.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        contactNumber: body.contactNumber,
        message: body.inquiry,
        productName: body.productName || null,
        edpNumber: body.edpNumber || null
      }
    })

    await Promise.all([
      mailer.sendInquiryConfirmation({ inquiry, config }),
      mailer.sendInquiryNotification({ inquiry, recipients: inquiryRecipients(config), config })
    ])

    res.status(201).json({
      message: 'Thank you. Your inquiry has been received by the Caracole PH team.',
      inquiry: serializeInquiry(inquiry)
    })
  }))

  return router
}
