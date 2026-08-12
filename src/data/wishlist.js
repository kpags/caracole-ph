const WISHLIST_KEY = 'caracole-wishlist'
export const WISHLIST_EVENT = 'caracole-wishlist-updated'

export function getWishlist() {
  if (typeof window === 'undefined') return []
  try {
    const value = JSON.parse(localStorage.getItem(WISHLIST_KEY) || '[]')
    return Array.isArray(value) ? value.map(String) : []
  } catch {
    return []
  }
}

export function saveWishlist(edpNumbers) {
  const unique = [...new Set(edpNumbers.map(String).filter(Boolean))]
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(unique))
  window.dispatchEvent(new CustomEvent(WISHLIST_EVENT, { detail: unique }))
  return unique
}

export function toggleWishlist(edpNumber) {
  const wishlist = getWishlist()
  const value = String(edpNumber)
  return saveWishlist(wishlist.includes(value) ? wishlist.filter((item) => item !== value) : [...wishlist, value])
}
