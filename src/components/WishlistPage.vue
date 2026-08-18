<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { getProductPath, productKey, useCatalog } from '../data/catalog.js'
import { getProductFacets, productTimestamp } from '../data/product-facets.js'
import { getWishlist, toggleWishlist, WISHLIST_EVENT } from '../data/wishlist.js'

const drawerOpen = ref(false)
const wishlist = ref([])
const category = ref('')
const subcategory = ref('')
const sort = ref('latest')
const selected = reactive({ sizes: [], finishes: [], materials: [], colors: [], fabrics: [], origins: [] })
const priceMin = ref('')
const priceMax = ref('')
const newArrivalsOnly = ref(false)
const inStockOnly = ref(false)
const page = ref(1)
const perPage = 10
const { products, status, error, load } = useCatalog()

const wishlistProducts = computed(() => wishlist.value.map((id) => products.value.find((product) => productKey(product) === id)).filter(Boolean).map((product) => ({ ...product, facets: getProductFacets(product) })))
const categoryOptions = computed(() => [...new Set(wishlistProducts.value.map((product) => product.displayCategory))].sort())
const subcategoryOptions = computed(() => [...new Set(wishlistProducts.value.filter((product) => !category.value || product.displayCategory === category.value).map((product) => product.subcategory).filter((value) => value && value !== '--'))].sort())

function uniqueFacet(key) {
  return computed(() => [...new Set(wishlistProducts.value.flatMap((product) => key === 'origins' ? [product.origin || 'Not specified'] : key === 'sizes' ? [product.facets.size] : product.facets[key]))].sort())
}

const sizeOptions = uniqueFacet('sizes')
const finishOptions = uniqueFacet('finishes')
const materialOptions = uniqueFacet('materials')
const colorOptions = uniqueFacet('colors')
const fabricOptions = uniqueFacet('fabrics')
const originOptions = uniqueFacet('origins')

function includesSelected(values, choices) { return !choices.length || choices.some((choice) => values.includes(choice)) }

const filteredProducts = computed(() => {
  const min = priceMin.value === '' ? -Infinity : Number(priceMin.value)
  const max = priceMax.value === '' ? Infinity : Number(priceMax.value)
  const items = wishlistProducts.value.filter((product) => {
    if (category.value && product.displayCategory !== category.value) return false
    if (subcategory.value && product.subcategory !== subcategory.value) return false
    if (selected.sizes.length && !selected.sizes.includes(product.facets.size)) return false
    if (!includesSelected(product.facets.finishes, selected.finishes)) return false
    if (!includesSelected(product.facets.materials, selected.materials)) return false
    if (!includesSelected(product.facets.colors, selected.colors)) return false
    if (!includesSelected(product.facets.fabrics, selected.fabrics)) return false
    if (selected.origins.length && !selected.origins.includes(product.origin || 'Not specified')) return false
    if (newArrivalsOnly.value && !product.isNewArrival) return false
    if (inStockOnly.value && Number(product.stockQuantity) <= 0) return false
    const price = Number(product.priceValue) || 0
    return price >= min && price <= max
  })
  return [...items].sort((a, b) => sort.value === 'name-asc' ? a.name.localeCompare(b.name) : sort.value === 'name-desc' ? b.name.localeCompare(a.name) : sort.value === 'oldest' ? productTimestamp(a) - productTimestamp(b) : productTimestamp(b) - productTimestamp(a))
})

const pageCount = computed(() => Math.max(1, Math.ceil(filteredProducts.value.length / perPage)))
const paginatedProducts = computed(() => filteredProducts.value.slice((page.value - 1) * perPage, page.value * perPage))
const activeFilterCount = computed(() => Object.values(selected).reduce((total, values) => total + values.length, 0) + [category.value, subcategory.value, priceMin.value, priceMax.value].filter((value) => value !== '').length + (newArrivalsOnly.value ? 1 : 0) + (inStockOnly.value ? 1 : 0))

function toggleSelection(group, value) { const index = selected[group].indexOf(value); index === -1 ? selected[group].push(value) : selected[group].splice(index, 1) }
function clearFilters() { Object.values(selected).forEach((values) => values.splice(0)); category.value = ''; subcategory.value = ''; priceMin.value = ''; priceMax.value = ''; newArrivalsOnly.value = false; inStockOnly.value = false }
function removeFromWishlist(product) { wishlist.value = toggleWishlist(productKey(product)) }
function refreshWishlist() { wishlist.value = getWishlist() }
function formatPrice(product) { const value = Number(product.priceValue); return value ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value) : 'Price upon request' }
function reviewMetrics(product) { const hash = [...String(product.edpNumber)].reduce((total, character) => total + character.charCodeAt(0), 0); return { rating: (4.2 + (hash % 8) / 10).toFixed(1), count: 24 + (hash * 7) % 438 } }
function formatReviewCount(count) { return count >= 101 ? `${Math.floor(count / 100) * 100}+` : String(count) }
function handleKey(event) { if (event.key === 'Escape') drawerOpen.value = false }

watch(category, () => { if (!subcategoryOptions.value.includes(subcategory.value)) subcategory.value = '' })
watch([category, subcategory, sort, priceMin, priceMax, newArrivalsOnly, inStockOnly, () => JSON.stringify(selected)], () => { page.value = 1 })
onMounted(() => { load().catch(() => {}); refreshWishlist(); window.addEventListener(WISHLIST_EVENT, refreshWishlist); window.addEventListener('keydown', handleKey) })
onBeforeUnmount(() => { window.removeEventListener(WISHLIST_EVENT, refreshWishlist); window.removeEventListener('keydown', handleKey) })
</script>

<template>
  <main id="main" class="wishlist-page">
    <header class="wishlist-page__header"><p class="eyebrow">Saved for later</p><h1>Wishlist</h1><p>Your personal edit of Caracole pieces, stored in this browser.</p></header>
    <section v-if="status === 'loading'" class="wishlist-empty"><p class="eyebrow">Loading collection</p><h2>Gathering your saved pieces.</h2></section>
    <section v-else-if="status === 'error'" class="wishlist-empty"><p class="eyebrow">Catalog unavailable</p><h2>We couldn’t load your saved pieces.</h2><p>{{ error }}</p><button type="button" @click="load({ force: true }).catch(() => {})">Try again</button></section>
    <section v-else-if="wishlistProducts.length" class="wishlist-products">
      <div class="wishlist-toolbar"><div class="wishlist-category-filters"><label>Main category<select v-model="category"><option value="">All categories</option><option v-for="option in categoryOptions" :key="option">{{ option }}</option></select></label><label>Subcategory<select v-model="subcategory"><option value="">All subcategories</option><option v-for="option in subcategoryOptions" :key="option">{{ option }}</option></select></label></div><div><span>{{ filteredProducts.length }} saved pieces</span><button type="button" @click="drawerOpen = true">Filters <b v-if="activeFilterCount">{{ activeFilterCount }}</b><i>+</i></button></div></div>
      <div v-if="paginatedProducts.length" class="catalog-grid" role="list"><article v-for="product in paginatedProducts" :key="productKey(product)" class="catalog-card" role="listitem"><div class="catalog-card__image"><a class="catalog-card__image-link" :href="getProductPath(product)"><img :src="product.image" :alt="product.name" loading="lazy" /></a><div class="catalog-card__badges"><span v-if="product.isNewArrival">New</span><span v-if="Number(product.stockQuantity) <= 0" class="out-of-stock">Out of Stock</span></div><button class="wishlist-heart active" type="button" :aria-label="`Remove ${product.name} from wishlist`" @click="removeFromWishlist(product)"><span aria-hidden="true">♥</span></button><div class="catalog-card__actions"><a :href="getProductPath(product)">View Piece</a></div></div><div class="catalog-card__copy"><a :href="getProductPath(product)"><h3>{{ product.name }}</h3></a><p class="catalog-card__price">{{ formatPrice(product) }}</p><p class="catalog-card__reviews"><span aria-hidden="true">★★★★★</span><b>{{ reviewMetrics(product).rating }}</b><small>({{ formatReviewCount(reviewMetrics(product).count) }} reviews)</small></p></div></article></div>
      <div v-else class="catalog-empty"><p class="eyebrow">No matching pieces</p><h2>Let’s widen the view.</h2><button type="button" @click="clearFilters">Clear all filters</button></div>
      <nav v-if="pageCount > 1" class="wishlist-pagination" aria-label="Wishlist pages"><button v-for="pageNumber in pageCount" :key="pageNumber" type="button" :class="{ active: page === pageNumber }" :aria-current="page === pageNumber ? 'page' : undefined" @click="page = pageNumber">{{ String(pageNumber).padStart(2, '0') }}</button></nav>
    </section>
    <section v-else class="wishlist-empty"><p class="eyebrow">Nothing saved yet</p><h2>Find something<br />to love.</h2><a href="/products/living">Explore the collection →</a></section>

    <div class="filter-backdrop" :class="{ open: drawerOpen }" @click="drawerOpen = false"></div><aside class="filter-drawer" :class="{ open: drawerOpen }" :aria-hidden="!drawerOpen" aria-label="Wishlist filters"><div class="filter-drawer__head"><div><p>Refine your saved pieces</p><h2>Filters</h2></div><button type="button" aria-label="Close filters" @click="drawerOpen = false">×</button></div><div class="filter-drawer__body"><details open><summary>Sort by <span>+</span></summary><div class="filter-options filter-options--sort"><label v-for="option in [{ value: 'name-asc', label: 'Name: A–Z' }, { value: 'name-desc', label: 'Name: Z–A' }, { value: 'latest', label: 'Latest' }, { value: 'oldest', label: 'Oldest' }]" :key="option.value"><input v-model="sort" type="radio" name="wishlist-sort" :value="option.value" /><span>{{ option.label }}</span></label></div></details><details v-for="group in [{ key: 'sizes', label: 'Size', options: sizeOptions }, { key: 'finishes', label: 'Finish', options: finishOptions }, { key: 'materials', label: 'Material', options: materialOptions }, { key: 'colors', label: 'Color', options: colorOptions }, { key: 'fabrics', label: 'Fabric Type', options: fabricOptions }, { key: 'origins', label: 'Origin', options: originOptions }]" :key="group.key"><summary>{{ group.label }} <span>+</span></summary><div class="filter-options"><label v-for="option in group.options" :key="option"><input type="checkbox" :checked="selected[group.key].includes(option)" @change="toggleSelection(group.key, option)" /><span>{{ option }}</span></label></div></details><details><summary>Availability <span>+</span></summary><div class="filter-options"><label><input v-model="newArrivalsOnly" type="checkbox" /><span>New Arrivals</span></label><label><input v-model="inStockOnly" type="checkbox" /><span>In Stock</span></label></div></details><details><summary>Price <span>+</span></summary><div class="price-fields"><label><span>Minimum (₱)</span><input v-model="priceMin" type="number" min="0" placeholder="0" /></label><label><span>Maximum (₱)</span><input v-model="priceMax" type="number" min="0" placeholder="No limit" /></label></div></details></div><div class="filter-drawer__foot"><button type="button" class="filter-clear" @click="clearFilters">Clear all</button><button type="button" class="filter-view" @click="drawerOpen = false">View {{ filteredProducts.length }} products</button></div></aside>
  </main>
</template>
