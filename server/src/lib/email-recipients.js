import { z } from 'zod'

export const EMAIL_NOTIFICATION_EVENTS = Object.freeze([
  'GENERAL_INQUIRY',
  'PRODUCT_INQUIRY',
  'DESIGNER_REGISTRATION'
])

export const emailNotificationEventSchema = z.enum(EMAIL_NOTIFICATION_EVENTS)

export const EMAIL_NOTIFICATION_EVENT_LABELS = Object.freeze({
  GENERAL_INQUIRY: 'General Inquiry',
  PRODUCT_INQUIRY: 'Product Inquiry',
  DESIGNER_REGISTRATION: 'Designer Registration'
})

const emailSchema = z.string().trim().toLowerCase().email().max(320)

export function configuredEmailRecipients(value) {
  return [...new Set(String(value || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => emailSchema.safeParse(email).success))]
}

function normalizeList(value, field) {
  const parsed = z.array(emailSchema).max(100, `${field} can include up to 100 email addresses`).safeParse(value)
  if (!parsed.success) {
    const invalid = Array.isArray(value) ? value.find((email) => !emailSchema.safeParse(email).success) : null
    throw new z.ZodError([{ code: 'custom', path: [field], message: invalid ? `Enter a valid email address in ${field}` : `${field} must be a list of email addresses` }])
  }
  return [...new Set(parsed.data)]
}

export function normalizeRecipientGroups(value = {}) {
  const to = normalizeList(value.to ?? value.toRecipients ?? [], 'To')
  const cc = normalizeList(value.cc ?? value.ccRecipients ?? [], 'CC').filter((email) => !to.includes(email))
  const bcc = normalizeList(value.bcc ?? value.bccRecipients ?? [], 'BCC').filter((email) => !to.includes(email) && !cc.includes(email))
  return { to, cc, bcc }
}

export function serializeEmailNotificationRecipients(configuration) {
  const recipients = normalizeRecipientGroups(configuration)
  return { event: configuration.event, ...recipients, updatedAt: configuration.updatedAt || null }
}

export async function getEmailNotificationRecipients(prisma, event) {
  const configuration = await prisma.emailNotificationRecipient.findUnique({ where: { event } })
  return configuration ? normalizeRecipientGroups(configuration) : { to: [], cc: [], bcc: [] }
}

export function hasEmailNotificationRecipients(recipients) {
  return Boolean(recipients?.to?.length || recipients?.cc?.length || recipients?.bcc?.length)
}
