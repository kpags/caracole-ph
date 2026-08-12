<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { getProductPath, productCatalog } from '../data/catalog.js'

const props = defineProps({ open: { type: Boolean, default: false } })
const emit = defineEmits(['close'])
const input = ref(null)
const query = ref('')
const results = ref([])
const searching = ref(false)
let searchTimer

function searchableText(product) {
  return [
    product.edpNumber, product.articleNumber, product.name, product.finish, product.size,
    ...(Array.isArray(product.categories) ? product.categories : []),
    product.primaryCategory, product.displayCategory, product.subcategory, product.series,
  ].filter(Boolean).join(' ').toLowerCase()
}

function runSearch(value) {
  const normalized = value.trim().toLowerCase()
  const terms = normalized.split(/\s+/).filter(Boolean)
  results.value = productCatalog
    .map((product) => {
      const haystack = searchableText(product)
      if (!terms.every((term) => haystack.includes(term))) return null
      let score = 0
      if (product.edpNumber?.toLowerCase() === normalized) score += 120
      if (product.articleNumber?.toLowerCase() === normalized) score += 110
      if (product.name?.toLowerCase() === normalized) score += 100
      else if (product.name?.toLowerCase().startsWith(normalized)) score += 70
      if (product.subcategory?.toLowerCase() === normalized) score += 55
      if (product.displayCategory?.toLowerCase() === normalized) score += 45
      return { product, score }
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.product.catalogOrder - b.product.catalogOrder)
    .slice(0, 12)
    .map(({ product }) => product)
  searching.value = false
}

function formatPrice(value) {
  return Number(value)
    ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value)
    : 'Price upon request'
}

watch(query, (value) => {
  window.clearTimeout(searchTimer)
  const normalized = value.trim()
  if (!normalized) {
    searching.value = false
    results.value = []
    return
  }
  searching.value = true
  searchTimer = window.setTimeout(() => runSearch(normalized), 1500)
})

watch(() => props.open, async (open) => {
  if (!open) return
  query.value = ''
  results.value = []
  searching.value = false
  await nextTick()
  input.value?.focus()
})

onBeforeUnmount(() => window.clearTimeout(searchTimer))
</script>

<template>
  <Teleport to="body">
    <Transition name="search-overlay">
      <div v-if="open" class="search-overlay" @click.self="emit('close')">
        <section class="search-dialog" role="dialog" aria-modal="true" aria-labelledby="product-search-title">
          <button class="search-dialog__close" type="button" aria-label="Close search" @click="emit('close')">×</button>
          <header><p class="eyebrow">Search the collection</p><h2 id="product-search-title">Find your piece.</h2></header>
          <div class="search-field">
            <span aria-hidden="true">⌕</span>
            <input ref="input" v-model="query" type="search" autocomplete="off" placeholder="Name, EDP, article, finish, size or category" aria-label="Search products" />
          </div>
          <div v-if="query.trim()" class="search-results" aria-live="polite">
            <div v-if="searching" class="search-results__state"><i></i><span>Searching the collection…</span></div>
            <template v-else-if="results.length">
              <div class="search-results__count">{{ results.length }} matching {{ results.length === 1 ? 'piece' : 'pieces' }}</div>
              <a v-for="product in results" :key="product.edpNumber" class="search-result" :href="getProductPath(product)">
                <img :src="product.image" :alt="product.name" />
                <span><small>{{ product.displayCategory }} · {{ product.subcategory === '--' ? 'Collection' : product.subcategory }}</small><b>{{ product.name }}</b><em>EDP {{ product.edpNumber }}<template v-if="product.articleNumber && product.articleNumber !== '--'"> · {{ product.articleNumber }}</template></em></span>
                <strong>{{ formatPrice(product.priceValue) }}</strong><i aria-hidden="true">→</i>
              </a>
            </template>
            <div v-else class="search-results__state"><span>No products match “{{ query.trim() }}”. Try another name, finish, dimension, or category.</span></div>
          </div>
          <p v-else class="search-dialog__hint">Search by EDP number, article number, product name, finish, dimensions, main category, or subcategory.</p>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
