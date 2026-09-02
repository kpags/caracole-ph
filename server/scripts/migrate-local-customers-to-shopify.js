import { PrismaClient } from '@prisma/client'
import { config } from '../src/config.js'
import { migrateLocalCustomersToShopify } from '../src/lib/shopify-customers.js'

const prisma = new PrismaClient()
try {
  await migrateLocalCustomersToShopify({ prisma, config })
} finally {
  await prisma.$disconnect()
}
