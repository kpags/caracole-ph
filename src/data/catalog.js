import filters from './catalog-filters.json'
import products from './products.json'

export const productCatalog = products
export const catalogFilters = filters

export function getProductByEdp(edpNumber) {
  return productCatalog.find((product) => product.edpNumber === edpNumber) ?? null
}

export function getProductPath(product) {
  return product?.edpNumber ? `/product/${encodeURIComponent(product.edpNumber)}` : '#'
}

export function filterProducts({ category, subcategory, query, newArrivalsOnly = false } = {}) {
  const search = String(query ?? '').trim().toLowerCase()

  return productCatalog.filter((product) => {
    if (category && product.displayCategory !== category) return false
    if (subcategory && product.subcategory !== subcategory) return false
    if (newArrivalsOnly && !product.isNewArrival) return false

    if (search) {
      const searchable = [product.name, product.edpNumber, product.articleNumber, product.series]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      if (!searchable.includes(search)) return false
    }

    return true
  })
}

export function getFilterGroup(category) {
  return catalogFilters.find((group) => group.name === category) ?? null
}
