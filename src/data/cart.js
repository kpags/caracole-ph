const CART_KEY = 'caracole-cart'
export const CART_EVENT = 'caracole-cart-updated'

function normalizeItem(item) {
  return {
    id: String(item.id ?? ''),
    handle: String(item.handle ?? ''),
    edpNumber: String(item.edpNumber ?? '--'),
    name: String(item.name ?? 'Caracole product'),
    image: item.image ?? null,
    priceValue: Number(item.priceValue) || 0,
    quantity: Math.max(1, Math.min(99, Number(item.quantity) || 1)),
  }
}

export function getCart() {
  if (typeof window === 'undefined') return []
  try {
    const value = JSON.parse(localStorage.getItem(CART_KEY) || '[]')
    return Array.isArray(value) ? value.map(normalizeItem).filter((item) => item.id) : []
  } catch {
    return []
  }
}

export function saveCart(items) {
  const normalized = items.map(normalizeItem).filter((item) => item.id)
  localStorage.setItem(CART_KEY, JSON.stringify(normalized))
  window.dispatchEvent(new CustomEvent(CART_EVENT, { detail: normalized }))
  return normalized
}

export function addCartItem(product, quantity = 1) {
  const cart = getCart()
  const existing = cart.find((item) => item.id === product.id)
  if (existing) existing.quantity = Math.min(99, existing.quantity + quantity)
  else cart.push(normalizeItem({ ...product, quantity }))
  return saveCart(cart)
}

export function setCartQuantity(id, quantity) {
  return saveCart(getCart().map((item) => item.id === id ? { ...item, quantity } : item))
}

export function removeCartItem(id) {
  return saveCart(getCart().filter((item) => item.id !== id))
}

export function cartSubtotal(items) {
  return items.reduce((total, item) => total + (Number(item.priceValue) || 0) * item.quantity, 0)
}

export function formatCartPrice(value) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(Number(value) || 0)
}
