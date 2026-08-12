import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { HttpError } from './http.js'

export function createAuth({ prisma, config }) {
  const issueTokens = async (user) => {
    const tokenId = crypto.randomUUID()
    const claims = { sub: user.id, isStaff: user.isStaff, isSuperuser: user.isSuperuser }
    const accessToken = jwt.sign({ ...claims, type: 'access' }, config.JWT_ACCESS_SECRET, { expiresIn: config.JWT_ACCESS_EXPIRES_IN })
    const refreshToken = jwt.sign({ ...claims, jti: tokenId, type: 'refresh' }, config.JWT_REFRESH_SECRET, { expiresIn: config.JWT_REFRESH_EXPIRES_IN })
    const decoded = jwt.decode(refreshToken)
    await prisma.refreshToken.create({ data: { id: tokenId, userId: user.id, tokenHash: await bcrypt.hash(refreshToken, config.BCRYPT_SALT_ROUNDS), expiresAt: new Date(decoded.exp * 1000) } })
    return { accessToken, refreshToken }
  }

  const createOtp = async (userId, purpose) => {
    const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
    await prisma.$transaction([
      prisma.otpCode.updateMany({ where: { userId, purpose, consumedAt: null }, data: { consumedAt: new Date() } }),
      prisma.otpCode.create({ data: { userId, purpose, codeHash: await bcrypt.hash(otp, config.BCRYPT_SALT_ROUNDS), expiresAt: new Date(Date.now() + 10 * 60 * 1000) } })
    ])
    return otp
  }

  const verifyOtp = async (userId, purpose, otp) => {
    const record = await prisma.otpCode.findFirst({ where: { userId, purpose, consumedAt: null }, orderBy: { createdAt: 'desc' } })
    if (!record || record.expiresAt <= new Date() || record.attempts >= 5) throw new HttpError(400, 'Invalid or expired OTP')
    const valid = await bcrypt.compare(otp, record.codeHash)
    const attempts = record.attempts + 1
    await prisma.otpCode.update({ where: { id: record.id }, data: valid ? { attempts, consumedAt: new Date() } : { attempts, ...(attempts >= 5 ? { consumedAt: new Date() } : {}) } })
    if (!valid) throw new HttpError(400, 'Invalid or expired OTP')
  }

  return { issueTokens, createOtp, verifyOtp }
}
