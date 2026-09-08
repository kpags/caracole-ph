const PAYMENT_GATEWAY_LOGO_FILES = Object.freeze({
  PAYMONGO: 'paymongo.png',
  STRIPE: 'stripe.png'
})

const DEFAULT_MEDIA_BASE_URL = 'https://cdn.caracole.ph'

export function paymentGatewayLogoUrl(provider, mediaBaseUrl) {
  const fileName = PAYMENT_GATEWAY_LOGO_FILES[String(provider || '').toUpperCase()]
  if (!fileName) return ''

  const baseUrl = (mediaBaseUrl || DEFAULT_MEDIA_BASE_URL).trim().replace(/\/+$/, '')
  return `${baseUrl}/logos/${fileName}`
}
