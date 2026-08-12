<script setup>
import { computed, onMounted, ref } from 'vue'
import { formatCartPrice } from '../data/cart.js'
import { getProductByEdp } from '../data/catalog.js'
import { getOrders } from '../data/orders.js'

const localOrders = ref([])
const statusFilter = ref('All')

function sampleItem(edpNumber, quantity = 1) {
  const product = getProductByEdp(edpNumber)
  if (!product) return null
  return { edpNumber, name: product.name, image: product.image, priceValue: product.priceValue, quantity }
}

function sampleOrder(number, status, placedAt, items) {
  const products = items.filter(Boolean)
  return {
    number,
    status,
    placedAt,
    items: products,
    total: products.reduce((sum, item) => sum + item.priceValue * item.quantity, 0),
    checkout: { customer: { firstName: 'John', lastName: 'Doe', email: 'johndoe@gmail.com' } },
  }
}

const sampleOrders = [
  sampleOrder('CAR-26071842', 'Pending', '2026-07-18T10:30:00+08:00', [sampleItem('04249-01584'), sampleItem('04249-01573')]),
  sampleOrder('CAR-26062917', 'Completed', '2026-06-29T14:15:00+08:00', [sampleItem('04249-01633'), sampleItem('04249-01639'), sampleItem('09656-00450', 2)]),
  sampleOrder('CAR-26051008', 'Cancelled', '2026-05-10T09:05:00+08:00', [sampleItem('04249-00460')]),
]

const orders = computed(() => [...localOrders.value.map((order) => ({ ...order, status: order.status || 'Completed' })), ...sampleOrders])
const filteredOrders = computed(() => statusFilter.value === 'All' ? orders.value : orders.value.filter((order) => order.status === statusFilter.value))
const itemCount = computed(() => orders.value.reduce((sum, order) => sum + order.items.reduce((count, item) => count + item.quantity, 0), 0))
const statusOptions = computed(() => ['All', 'Pending', 'Completed', 'Cancelled'].map((status) => ({
  status,
  count: status === 'All' ? orders.value.length : orders.value.filter((order) => order.status === status).length,
})))

function displayDate(value) {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value))
}

onMounted(() => { localOrders.value = getOrders() })
</script>

<template>
  <main id="main" class="orders-page">
    <header class="orders-page__header"><p class="eyebrow">Your Caracole collection</p><h1>Order History</h1><p>Your guest and account orders remain available in this browser only. Clearing cookies, cache, or site data removes this history.</p></header>
    <nav class="orders-tabs" aria-label="Filter order history">
      <button v-for="option in statusOptions" :key="option.status" type="button" :class="{ active: statusFilter === option.status }" :aria-pressed="statusFilter === option.status" @click="statusFilter = option.status">{{ option.status }} Orders <span>({{ option.count }})</span></button>
    </nav>
    <section v-if="filteredOrders.length" class="orders-list" :aria-label="`${orders.length} orders containing ${itemCount} products`">
      <article v-for="order in filteredOrders" :key="order.number" class="order-history-card">
        <header><div><span>Order</span><h2>{{ order.number }}</h2></div><div><span>Placed</span><p>{{ displayDate(order.placedAt) }}</p></div><strong :class="`status-${order.status.toLowerCase()}`">{{ order.status }}</strong></header>
        <div class="order-history-card__items"><a v-for="item in order.items" :key="item.edpNumber" :href="`/product/${encodeURIComponent(item.edpNumber)}`"><img :src="item.image" :alt="item.name" /><span><b>{{ item.name }}</b><small>Quantity {{ item.quantity }}</small></span><strong>{{ formatCartPrice(item.priceValue * item.quantity) }}</strong></a></div>
        <footer><span>{{ order.checkout.customer.firstName }} {{ order.checkout.customer.lastName }} · {{ order.checkout.customer.email }}</span><b>{{ formatCartPrice(order.total) }}</b></footer>
      </article>
    </section>
    <section v-else class="orders-empty"><p class="eyebrow">No {{ statusFilter.toLowerCase() }} orders</p><h2>Nothing is waiting<br />in this collection.</h2><button type="button" @click="statusFilter = 'All'">View all orders</button></section>
  </main>
</template>
