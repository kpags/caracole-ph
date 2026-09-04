import { config } from '../src/config.js'
import { configuredEmailRecipients } from '../src/lib/email-recipients.js'
import { prisma } from '../src/lib/prisma.js'

const initialConfigurations = [
  { event: 'GENERAL_INQUIRY', toRecipients: configuredEmailRecipients(config.INQUIRY_RECEIVERS) },
  { event: 'PRODUCT_INQUIRY', toRecipients: configuredEmailRecipients(config.INQUIRY_RECEIVERS) },
  { event: 'DESIGNER_REGISTRATION', toRecipients: configuredEmailRecipients(config.DESIGNER_REGISTRATION_RECEIVERS) }
]

async function seedEmailNotificationRecipients() {
  let created = 0
  for (const configuration of initialConfigurations) {
    const existing = await prisma.emailNotificationRecipient.findUnique({ where: { event: configuration.event }, select: { id: true } })
    if (existing) continue
    await prisma.emailNotificationRecipient.create({ data: { ...configuration, ccRecipients: [], bccRecipients: [] } })
    created += 1
  }
  console.log(`Email notification recipient seed completed: ${created} event(s) created.`)
}

try {
  await seedEmailNotificationRecipients()
} finally {
  await prisma.$disconnect()
}
