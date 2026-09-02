import { prisma } from '../src/lib/prisma.js'
import { purgePendingCustomers } from '../src/lib/pending-customer-cleanup.js'

try {
  await purgePendingCustomers(prisma)
} finally {
  await prisma.$disconnect()
}
