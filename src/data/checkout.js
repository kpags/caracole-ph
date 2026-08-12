const CHECKOUT_KEY = 'caracole-checkout'

export function getCheckout() {
  if (typeof window === 'undefined') return null
  try {
    return JSON.parse(localStorage.getItem(CHECKOUT_KEY) || 'null')
  } catch {
    return null
  }
}

export function saveCheckout(details) {
  localStorage.setItem(CHECKOUT_KEY, JSON.stringify(details))
  return details
}

export function clearCheckout() {
  localStorage.removeItem(CHECKOUT_KEY)
}
