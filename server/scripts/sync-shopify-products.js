import { config } from '../src/config.js'
import { prisma } from '../src/lib/prisma.js'
import { syncShopifyProducts } from '../src/lib/shopify-admin-sync.js'

try {
  console.log(JSON.stringify(await syncShopifyProducts({ prisma, config })))
} finally {
  await prisma.$disconnect()
}
