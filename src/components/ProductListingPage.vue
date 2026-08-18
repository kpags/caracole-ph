<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { getProductPath, productKey, useCatalog } from '../data/catalog.js'
import { getProductFacets, productTimestamp } from '../data/product-facets.js'
import { getWishlist, toggleWishlist, WISHLIST_EVENT } from '../data/wishlist.js'
import ProductImageCarousel from './ProductImageCarousel.vue'
import Paginator from 'primevue/paginator'

const props = defineProps({
  category: { type: String, default: '' },
  subcategory: { type: String, default: '' },
  newArrivalsPage: { type: Boolean, default: false },
})

const categoryStories = {
  Living: { image: '/media/shop-the-look/living-room.jpeg', copy: 'Sculptural seating and expressive tables, composed for rooms where life unfolds.' },
  Dining: { image: '/media/shop-the-look/dining-room.jpeg', copy: 'Refined silhouettes for everyday rituals, generous gatherings, and evenings that linger.' },
  Bedroom: { image: '/media/shop-the-look/bedroom.jpeg', copy: 'Quietly luxurious forms and tactile details for a retreat that feels entirely your own.' },
  'Mirrors & Accessories': { image: '/media/shop-the-look/mirrors_living_room.jpeg', copy: 'Reflective forms and considered accents that bring depth, light, and personality to a room.' },
  Entertainment: { image: '/media/staged/entertainment_living_room_one.jpeg', copy: 'Architectural media pieces that balance effortless function with a composed point of view.' },
}

const drawerOpen = ref(false)
const sort = ref('latest')
const selected = reactive({ sizes: [], finishes: [], materials: [], colors: [], fabrics: [], origins: [] })
const priceMin = ref('')
const priceMax = ref('')
const newArrivalsOnly = ref(false)
const inStockOnly = ref(false)
const notificationSet = ref(new Set())
const wishlistSet = ref(new Set())
const { products, pagination, status, error, load } = useCatalog()
const page = ref(1)
const limit = ref(24)
const first = computed(() => (page.value - 1) * limit.value)

function loadPage(nextPage = page.value, { force = false } = {}) {
  page.value = nextPage
  return load({ force, page: nextPage, limit: limit.value, ...(props.newArrivalsPage ? {} : { category: props.category }), ...(props.subcategory ? { subcategory: props.subcategory } : {}) }).catch(() => {})
}

function handlePageChange(event) {
  const rowsChanged = event.rows !== limit.value
  limit.value = event.rows
  loadPage(rowsChanged ? 1 : event.page + 1)
}

const baseProducts = computed(() => products.value
  .filter((product) => props.newArrivalsPage ? product.isNewArrival : product.displayCategory === props.category)
  .filter((product) => props.newArrivalsPage || !props.subcategory || product.subcategory === props.subcategory)
  .map((product) => ({ ...product, facets: getProductFacets(product) })))

function uniqueFacet(key) {
  return computed(() => [...new Set(baseProducts.value.flatMap((product) => product.facets[key]))].sort((a, b) => a.localeCompare(b)))
}

const sizeOptions = computed(() => ['Small', 'Medium', 'Large', 'Oversized', 'Unspecified'].filter((size) => baseProducts.value.some((product) => product.facets.size === size)))
const finishOptions = uniqueFacet('finishes')
const materialOptions = uniqueFacet('materials')
const colorOptions = uniqueFacet('colors')
const fabricOptions = uniqueFacet('fabrics')
const originOptions = computed(() => [...new Set(baseProducts.value.map((product) => product.origin || 'Not specified'))].sort((a, b) => a.localeCompare(b)))

function includesSelected(values, choices) {
  return !choices.length || choices.some((choice) => values.includes(choice))
}

const filteredProducts = computed(() => {
  const min = priceMin.value === '' ? -Infinity : Number(priceMin.value)
  const max = priceMax.value === '' ? Infinity : Number(priceMax.value)
  const items = baseProducts.value.filter((product) => {
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

  return [...items].sort((a, b) => {
    if (sort.value === 'name-asc') return a.name.localeCompare(b.name)
    if (sort.value === 'name-desc') return b.name.localeCompare(a.name)
    if (sort.value === 'oldest') return productTimestamp(a) - productTimestamp(b)
    return productTimestamp(b) - productTimestamp(a)
  })
})

const activeFilterCount = computed(() => Object.values(selected).reduce((total, values) => total + values.length, 0) + (priceMin.value !== '' ? 1 : 0) + (priceMax.value !== '' ? 1 : 0) + (newArrivalsOnly.value ? 1 : 0) + (inStockOnly.value ? 1 : 0))
const story = computed(() => categoryStories[props.category] ?? categoryStories.Living)
const pageTitle = computed(() => props.newArrivalsPage ? 'New Arrivals' : (props.subcategory || props.category))
const collectionLabel = computed(() => props.newArrivalsPage ? 'new arrivals' : props.category.toLowerCase())

function toggleSelection(group, value) {
  const values = selected[group]
  const index = values.indexOf(value)
  if (index === -1) values.push(value)
  else values.splice(index, 1)
}

function clearFilters() {
  Object.values(selected).forEach((values) => values.splice(0))
  priceMin.value = ''
  priceMax.value = ''
  newArrivalsOnly.value = false
  inStockOnly.value = false
}

function formatPrice(product) {
  const value = Number(product.priceValue)
  return value ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value) : 'Price upon request'
}

function reviewMetrics(product) {
  const hash = [...String(product.edpNumber)].reduce((total, character) => total + character.charCodeAt(0), 0)
  return { rating: (4.2 + (hash % 8) / 10).toFixed(1), count: 24 + (hash * 7) % 438 }
}

function formatReviewCount(count) {
  return count >= 101 ? `${Math.floor(count / 100) * 100}+` : String(count)
}

function notifyWhenAvailable(product) {
  const next = new Set(notificationSet.value)
  next.add(productKey(product))
  notificationSet.value = next
  localStorage.setItem('caracole-stock-notifications', JSON.stringify([...next]))
}

function updateWishlist(product) {
  wishlistSet.value = new Set(toggleWishlist(productKey(product)))
}

function refreshWishlist() {
  wishlistSet.value = new Set(getWishlist())
}

function handleKey(event) {
  if (event.key === 'Escape') drawerOpen.value = false
}

onMounted(() => {
  loadPage()
  window.addEventListener('keydown', handleKey)
  window.addEventListener(WISHLIST_EVENT, refreshWishlist)
  refreshWishlist()
  try { notificationSet.value = new Set(JSON.parse(localStorage.getItem('caracole-stock-notifications') || '[]')) } catch { notificationSet.value = new Set() }
})
watch(() => [props.category, props.subcategory, props.newArrivalsPage], () => loadPage(1))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKey)
  window.removeEventListener(WISHLIST_EVENT, refreshWishlist)
})
</script>

<template>
  <main id="main" class="catalog-page">
    <section v-if="!newArrivalsPage" class="catalog-hero">
      <img :src="story.image" :alt="`${category} collection interior`" />
      <div class="catalog-hero__shade"></div>
      <div class="catalog-hero__content">
        <p class="eyebrow light">The Collection</p>
        <p class="catalog-breadcrumb"><a href="/">Home</a><span>/</span>{{ category }}<template v-if="subcategory"><span>/</span>{{ subcategory }}</template></p>
        <h1>{{ subcategory || category }}</h1>
        <p>{{ story.copy }}</p>
      </div>
    </section>

    <section class="catalog-products" :class="{ 'catalog-products--standalone': newArrivalsPage }" aria-labelledby="catalog-heading">
      <div class="catalog-toolbar">
        <div>
          <p class="eyebrow">{{ newArrivalsPage ? 'Just landed' : 'Curated for you' }}</p>
          <h2 id="catalog-heading">{{ newArrivalsPage ? pageTitle : (subcategory || `${category} Collection`) }}</h2>
        </div>
        <div class="catalog-toolbar__actions">
          <span>{{ pagination.totalItems }} pieces</span>
          <button type="button" @click="drawerOpen = true">Filters <b v-if="activeFilterCount">{{ activeFilterCount }}</b><i>+</i></button>
        </div>
      </div>

      <div v-if="status === 'loading'" class="catalog-empty"><p class="eyebrow">Loading collection</p><h2>Gathering the pieces.</h2></div>
      <div v-else-if="status === 'error'" class="catalog-empty"><p class="eyebrow">Catalog unavailable</p><h2>We couldn’t load the collection.</h2><p>{{ error }}</p><button type="button" @click="loadPage(page, { force: true })">Try again</button></div>
      <div v-else-if="filteredProducts.length" class="catalog-grid" role="list">
        <article v-for="product in filteredProducts" :key="productKey(product)" class="catalog-card" role="listitem">
          <div class="catalog-card__image">
            <a class="catalog-card__image-link" :href="getProductPath(product)"><ProductImageCarousel :product="product" /></a>
            <div class="catalog-card__badges"><span v-if="product.isNewArrival">New</span><span v-if="Number(product.stockQuantity) <= 0" class="out-of-stock">Out of Stock</span></div>
            <button class="wishlist-heart" type="button" :class="{ active: wishlistSet.has(productKey(product)) }" :aria-label="wishlistSet.has(productKey(product)) ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`" @click="updateWishlist(product)"><span aria-hidden="true">{{ wishlistSet.has(productKey(product)) ? '♥' : '♡' }}</span></button>
            <div class="catalog-card__actions"><a :href="getProductPath(product)">View Piece</a><button v-if="Number(product.stockQuantity) <= 0" type="button" :class="{ active: notificationSet.has(productKey(product)) }" @click="notifyWhenAvailable(product)"><span class="bell-icon" aria-hidden="true"></span>{{ notificationSet.has(productKey(product)) ? 'Notification Set' : 'Notify Me' }}</button></div>
          </div>
          <div class="catalog-card__copy">
            <a :href="getProductPath(product)"><h3>{{ product.name }}</h3></a>
            <p class="catalog-card__price">{{ formatPrice(product) }}</p>
            <p class="catalog-card__reviews"><span aria-hidden="true">★★★★★</span><b>{{ reviewMetrics(product).rating }}</b><small>({{ formatReviewCount(reviewMetrics(product).count) }} reviews)</small></p>
          </div>
        </article>
      </div>
      <Paginator
        v-if="pagination.totalPages > 1"
        class="catalog-paginator"
        :first="first"
        :rows="limit"
        :total-records="pagination.totalItems"
        :rows-per-page-options="[24, 48, 72]"
        :disabled="status === 'loading'"
        @page="handlePageChange"
      />
      <div v-else-if="!filteredProducts.length" class="catalog-empty">
        <p class="eyebrow">No matching pieces</p>
        <h2>Let’s widen the view.</h2>
        <p>Clear your selected filters to see more of the {{ collectionLabel }} collection.</p>
        <button type="button" @click="clearFilters">Clear all filters</button>
      </div>
    </section>

    <div class="filter-backdrop" :class="{ open: drawerOpen }" @click="drawerOpen = false"></div>
    <aside class="filter-drawer" :class="{ open: drawerOpen }" :aria-hidden="!drawerOpen" aria-label="Product filters">
      <div class="filter-drawer__head">
        <div><p>Refine the collection</p><h2>Filters</h2></div>
        <button type="button" aria-label="Close filters" @click="drawerOpen = false">×</button>
      </div>

      <div class="filter-drawer__body">
        <details v-for="group in [{ key: 'sizes', label: 'Size', options: sizeOptions }, { key: 'finishes', label: 'Finish', options: finishOptions }, { key: 'materials', label: 'Material', options: materialOptions }, { key: 'colors', label: 'Color', options: colorOptions }, { key: 'fabrics', label: 'Fabric Type', options: fabricOptions }]" :key="group.key">
          <summary>{{ group.label }} <span>+</span></summary>
          <div class="filter-options">
            <label v-for="option in group.options" :key="option">
              <input type="checkbox" :checked="selected[group.key].includes(option)" @change="toggleSelection(group.key, option)" /><span>{{ option }}</span>
            </label>
            <p v-if="!group.options.length">No options available for this collection.</p>
          </div>
        </details>

        <details>
          <summary>Origin <span>+</span></summary>
          <div class="filter-options"><label v-for="option in originOptions" :key="option"><input type="checkbox" :checked="selected.origins.includes(option)" @change="toggleSelection('origins', option)" /><span>{{ option }}</span></label></div>
        </details>

        <details>
          <summary>Availability <span>+</span></summary>
          <div class="filter-options"><label v-if="!newArrivalsPage"><input v-model="newArrivalsOnly" type="checkbox" /><span>New Arrivals</span></label><label><input v-model="inStockOnly" type="checkbox" /><span>In Stock</span></label></div>
        </details>

        <details>
          <summary>Price <span>+</span></summary>
          <div class="price-fields">
            <label><span>Minimum (₱)</span><input v-model="priceMin" type="number" min="0" placeholder="0" /></label>
            <label><span>Maximum (₱)</span><input v-model="priceMax" type="number" min="0" placeholder="No limit" /></label>
          </div>
        </details>

        <details open>
          <summary>Sort by <span>+</span></summary>
          <div class="filter-options filter-options--sort">
            <label v-for="option in [{ value: 'name-asc', label: 'Name: A–Z' }, { value: 'name-desc', label: 'Name: Z–A' }, { value: 'latest', label: 'Latest' }, { value: 'oldest', label: 'Oldest' }]" :key="option.value">
              <input v-model="sort" type="radio" name="sort" :value="option.value" /><span>{{ option.label }}</span>
            </label>
          </div>
        </details>
      </div>

      <div class="filter-drawer__foot">
        <button type="button" class="filter-clear" @click="clearFilters">Clear all</button>
        <button type="button" class="filter-view" @click="drawerOpen = false">View {{ filteredProducts.length }} products</button>
      </div>
    </aside>
  </main>
</template>
