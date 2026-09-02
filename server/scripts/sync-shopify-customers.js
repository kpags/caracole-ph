import { PrismaClient } from '@prisma/client'
import { config } from '../src/config.js'
import { runShopifyCustomerSync } from '../src/lib/shopify-customers.js'

const prisma = new PrismaClient()
try {
  const result = await runShopifyCustomerSync({ prisma, config })
  if (!result.started) console.log(result.reason)
} finally {
  await prisma.$disconnect()
}
