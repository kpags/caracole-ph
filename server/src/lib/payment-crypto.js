import crypto from 'node:crypto'

function encryptionKey(value) {
  const key = Buffer.from(String(value || ''), 'base64')
  if (key.length !== 32) throw new TypeError('PAYMENT_CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte key')
  return key
}

export function encryptPaymentSecret(value, keyValue) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError('Payment secret is required')
  const key = encryptionKey(keyValue)
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(value.trim(), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([Buffer.from([1]), iv, tag, ciphertext]).toString('base64')
}

export function decryptPaymentSecret(value, keyValue) {
  const encrypted = Buffer.from(String(value || ''), 'base64')
  if (encrypted.length < 30 || encrypted[0] !== 1) throw new TypeError('Stored payment secret is invalid')
  const key = encryptionKey(keyValue)
  const iv = encrypted.subarray(1, 13)
  const tag = encrypted.subarray(13, 29)
  const ciphertext = encrypted.subarray(29)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

export function paymentSecretFingerprint(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex')
}

export function hashPaymentAccessToken(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex')
}

export function createPaymentAccessToken() {
  return crypto.randomBytes(32).toString('base64url')
}

export function verifyPaymongoSignature({ signature, payload, secret, liveMode, now = Date.now(), toleranceSeconds = 300 }) {
  if (typeof signature !== 'string' || !Buffer.isBuffer(payload) || !secret) return false
  const parts = Object.fromEntries(signature.split(',').map((part) => part.trim().split('=', 2)).filter(([key, value]) => key && value))
  const timestamp = Number(parts.t)
  const candidate = liveMode ? parts.li : parts.te
  if (!Number.isFinite(timestamp) || !candidate || Math.abs(now - timestamp * 1000) > toleranceSeconds * 1000) return false
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload.toString('utf8')}`).digest('hex')
  const received = Buffer.from(candidate, 'hex')
  const calculated = Buffer.from(expected, 'hex')
  return received.length === calculated.length && crypto.timingSafeEqual(received, calculated)
}
