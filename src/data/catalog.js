import { computed, readonly, ref } from 'vue'
import filters from './catalog-filters.json'

const products = ref([])
const pagination = ref({ page: 1, limit: 24, totalItems: 0, totalPages: 0 })
const productByHandle = ref(null)
const status = ref('idle')
const error = ref('')
let pendingRequest = null
const apiBaseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '')

export const catalogProducts = readonly(products)
export const catalogStatus = readonly(status)
export const catalogError = readonly(error)
export const catalogPagination = readonly(pagination)
export const catalogFilters = filters

export function getProductPath(product) {
  return product?.handle ? `/product/${encodeURIComponent(product.handle)}` : '#'
}

export function productKey(product) {
  return String(product?.id || '')
}

export function getProductByHandle(handle) {
  return productByHandle.value?.handle === handle
    ? productByHandle.value
    : products.value.find((product) => product.handle === handle) ?? null
}

export function getProductByEdp(edpNumber) {
  return products.value.find((product) => product.edpNumber === edpNumber) ?? null
}

export async function loadCatalog({ force = false, ...params } = {}) {
  if (status.value === 'ready' && !force && !Object.keys(params).length) return products.value
  if (pendingRequest && !force) return pendingRequest
  status.value = 'loading'
  error.value = ''
  const searchParams = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '').map(([key, value]) => [key, String(value)]))
  pendingRequest = fetch(`${apiBaseUrl}/api/v1/products${searchParams.size ? `?${searchParams}` : ''}`)
    .then(async (response) => {
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.message || payload.error?.message || 'The live catalog is unavailable.')
      products.value = Array.isArray(payload.products) ? payload.products : []
      pagination.value = payload.pagination || { page: 1, limit: products.value.length, totalItems: products.value.length, totalPages: 1 }
      status.value = 'ready'
      return products.value
    })
    .catch((reason) => {
      products.value = []
      error.value = reason.message || 'The live catalog is unavailable.'
      status.value = 'error'
      throw reason
    })
    .finally(() => { pendingRequest = null })
  return pendingRequest
}

export async function loadProductByHandle(handle) {
  const response = await fetch(`${apiBaseUrl}/api/v1/products/${encodeURIComponent(handle)}`)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || 'The product is unavailable.')
  productByHandle.value = payload.product || null
  return productByHandle.value
}

export function useCatalog() {
  return { products: catalogProducts, pagination: catalogPagination, status: catalogStatus, error: catalogError, load: loadCatalog, ready: computed(() => status.value === 'ready') }
}
