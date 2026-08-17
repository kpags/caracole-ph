import { config } from './config.js'
import { createApp } from './app.js'
import { createAuth } from './lib/auth.js'
import { createMailer } from './lib/email.js'
import { prisma } from './lib/prisma.js'
import { createCloudflareR2StorageFromConfig } from './lib/cloudflare-r2-storage.js'

const app = createApp({
  prisma,
  config,
  auth: createAuth({ prisma, config }),
  mailer: createMailer(config),
  storage: createCloudflareR2StorageFromConfig(config)
})
const server = app.listen(config.PORT, () => console.log(`API listening on port ${config.PORT}`))

async function shutdown(signal) {
  console.log(`${signal} received; shutting down.`)
  server.close(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
}
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
