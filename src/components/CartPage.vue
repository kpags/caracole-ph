<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { CART_EVENT, cartSubtotal, formatCartPrice, getCart, removeCartItem, setCartQuantity } from '../data/cart.js'

const items = ref([])
const subtotal = computed(() => cartSubtotal(items.value))

function refresh() {
  items.value = getCart()
}

function changeQuantity(item, amount) {
  setCartQuantity(item.id, Math.max(1, Math.min(99, item.quantity + amount)))
}

function removeItem(id) {
  removeCartItem(id)
}

function checkout() {
  window.location.href = '/checkout'
}

onMounted(() => {
  refresh()
  window.addEventListener(CART_EVENT, refresh)
  window.addEventListener('storage', refresh)
})
onBeforeUnmount(() => {
  window.removeEventListener(CART_EVENT, refresh)
  window.removeEventListener('storage', refresh)
})
</script>

<template>
  <main id="main" class="cart-page">
    <div class="cart-page__breadcrumb"><a href="/">Home</a><span>/</span>Cart</div>
    <header class="cart-page__heading"><p class="eyebrow">My Caracole</p><h1>Shopping Cart</h1><p>{{ items.length ? `${items.length} considered piece${items.length === 1 ? '' : 's'}, ready for your home.` : 'Your collection is waiting to be composed.' }}</p></header>

    <section v-if="items.length" class="cart-layout">
      <div class="cart-table">
        <div class="cart-table__head"><span>Product</span><span>Price</span><span>Quantity</span><span>Total</span></div>
        <article v-for="item in items" :key="item.id" class="cart-row">
          <button class="cart-remove" type="button" :aria-label="`Remove ${item.name}`" @click="removeItem(item.id)">×</button>
          <a class="cart-row__product" :href="`/product/${encodeURIComponent(item.handle)}`"><img :src="item.image" :alt="item.name" /><span><b>{{ item.name }}</b><small v-if="item.edpNumber !== '--'">EDP {{ item.edpNumber }}</small></span></a>
          <span class="cart-row__price">{{ formatCartPrice(item.priceValue) }}</span>
          <div class="cart-row__quantity"><button type="button" @click="changeQuantity(item, -1)">−</button><span>{{ item.quantity }}</span><button type="button" @click="changeQuantity(item, 1)">+</button></div>
          <strong>{{ formatCartPrice(item.priceValue * item.quantity) }}</strong>
        </article>
        <div class="cart-table__foot"><a href="/products/living">← Continue shopping</a><span>Quantities and totals update automatically.</span></div>
      </div>

      <aside class="cart-summary">
        <p>Order details</p><h2>Cart totals</h2>
        <dl><div><dt>Subtotal</dt><dd>{{ formatCartPrice(subtotal) }}</dd></div><div><dt>Delivery</dt><dd>Calculated after confirmation</dd></div><div><dt>Total</dt><dd>{{ formatCartPrice(subtotal) }}</dd></div></dl>
        <button type="button" @click="checkout">Proceed to checkout</button>
      </aside>
    </section>

    <section v-else class="cart-empty">
      <p class="eyebrow">Your cart is empty</p><h2>Find the piece<br />that moves you.</h2><a href="/products/living">Explore the collection →</a>
    </section>
  </main>
</template>
