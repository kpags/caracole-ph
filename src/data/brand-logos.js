const LOGO_FILES = Object.freeze({
  black: 'caracole_black.png',
  white: 'caracole_white.png',
  charcoal: 'caracole_charcoal.png',
  butternut: 'caracole_butternut.png'
})

const DEFAULT_MEDIA_BASE_URL = 'https://cdn.caracole.ph'

export function brandLogoUrl(variant, mediaBaseUrl) {
  const fileName = LOGO_FILES[variant]
  if (!fileName) throw new TypeError(`Unknown Caracole logo variant: ${variant}`)

  const baseUrl = (mediaBaseUrl || DEFAULT_MEDIA_BASE_URL).trim().replace(/\/+$/, '')
  return `${baseUrl}/logos/${fileName}`
}
