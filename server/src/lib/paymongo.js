import { HttpError } from './http.js'

export const PAYMONGO_BASE_URL = 'https://api.paymongo.com'
export const PAYMONGO_WEBHOOK_EVENTS = ['checkout_session.payment.paid', 'payment.paid', 'payment.failed']
// The merchant explicitly requested every currently supported Hosted Checkout
// method. PayMongo rejects a session if its account has not enabled one.
export const PAYMONGO_PAYMENT_METHOD_TYPES = ['card', 'gcash', 'paymaya', 'grab_pay', 'shopeepay', 'qrph', 'atome', 'billease', 'bpi', 'ubp', 'dob', 'metrobank', 'landbank']

function authorization(secretKey) {
  return `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`
}

async function request({ fetchImpl = fetch, secretKey, path, method = 'GET', body }) {
  let response
  try {
    response = await fetchImpl(`${PAYMONGO_BASE_URL}${path}`, {
      method,
      headers: { Authorization: authorization(secretKey), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    })
  } catch {
    throw new HttpError(502, 'PayMongo could not be reached. Please try again.')
  }
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = payload?.errors?.[0]?.detail || payload?.errors?.[0]?.code || payload?.message
    throw new HttpError(502, detail ? `PayMongo request failed: ${detail}` : 'PayMongo request failed')
  }
  return payload
}

export function createPaymongoClient({ secretKey, fetchImpl }) {
  return {
    verifyCredentials() {
      // A read-only authenticated request verifies the supplied secret without
      // creating, changing, or exposing any PayMongo resources.
      return request({ fetchImpl, secretKey, path: '/v1/webhooks' })
    },
    createCheckoutSession(attributes) {
      return request({ fetchImpl, secretKey, path: '/v2/checkout_sessions', method: 'POST', body: { data: { attributes } } })
    },
    createWebhook({ eventType, url }) {
      return request({
        fetchImpl,
        secretKey,
        path: '/v1/webhooks',
        method: 'POST',
        body: { data: { attributes: { events: [eventType], url } } }
      })
    },
    deleteWebhook(providerWebhookId) {
      return request({ fetchImpl, secretKey, path: `/v1/webhooks/${encodeURIComponent(providerWebhookId)}`, method: 'DELETE' })
    },
    expireCheckoutSession(sessionId) {
      return request({ fetchImpl, secretKey, path: `/v1/checkout_sessions/${encodeURIComponent(sessionId)}/expire`, method: 'POST' })
    }
  }
}
