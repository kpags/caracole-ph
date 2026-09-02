import { PrismaClient } from '@prisma/client'
import { config } from '../src/config.js'
import { syncShopifyCustomers } from '../src/lib/shopify-customers.js'

const prisma = new PrismaClient()
try {
  await syncShopifyCustomers({ prisma, config })
} finally {
  await prisma.$disconnect()
}
