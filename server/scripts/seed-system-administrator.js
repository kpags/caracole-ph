import bcrypt from 'bcryptjs'
import { config } from '../src/config.js'
import { prisma } from '../src/lib/prisma.js'

const email = config.SEED_SUPERUSER_EMAIL?.toLowerCase()
const password = config.SEED_SUPERUSER_PASSWORD

try {
  if (!email && !password) {
    console.log('System-administrator seed skipped: configure SEED_SUPERUSER_EMAIL and SEED_SUPERUSER_PASSWORD to create it.')
    process.exit(0)
  }
  if (!email || !password) throw new Error('Set both SEED_SUPERUSER_EMAIL and SEED_SUPERUSER_PASSWORD, or leave both blank.')

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`Default system administrator already exists for ${email}; preserving the existing account.`)
    process.exit(0)
  }

  await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash(password, config.BCRYPT_SALT_ROUNDS),
      isStaff: true,
      isSuperuser: true,
      isEmailVerified: true
    }
  })
  console.log(`Default system administrator created for ${email}.`)
} finally {
  await prisma.$disconnect()
}
