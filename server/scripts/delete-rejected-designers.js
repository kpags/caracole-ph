import { prisma } from '../src/lib/prisma.js'
import { purgeRejectedDesigners } from '../src/lib/rejected-designer-cleanup.js'

try {
  await purgeRejectedDesigners(prisma)
} finally {
  await prisma.$disconnect()
}
