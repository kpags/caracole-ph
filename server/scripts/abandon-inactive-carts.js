import { prisma } from '../src/lib/prisma.js'
import { abandonInactiveCarts } from '../src/lib/cart-abandonment.js'

try {
  await abandonInactiveCarts(prisma)
} finally {
  await prisma.$disconnect()
}
