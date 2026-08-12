<script setup>
import { computed, onMounted, ref } from 'vue'
import { cartSubtotal, formatCartPrice, getCart, saveCart } from '../data/cart.js'
import { clearCheckout, getCheckout } from '../data/checkout.js'
import { saveOrder } from '../data/orders.js'

const items = ref([])
const checkout = ref(null)
const orderNumber = ref('')
const subtotal = computed(() => cartSubtotal(items.value))
const total = computed(() => subtotal.value + Number(checkout.value?.shippingFee || 0))
const shippingNames = { standard: 'Standard delivery', whiteGlove: 'White-glove delivery', pickup: 'Showroom collection' }
const paymentNames = { gcash: 'GCash', card: 'Credit Card', flexible: 'Installment', qrph: 'QRPH' }

function displayDate(value) {
  if (!value) return 'To be arranged'
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'long' }).format(new Date(`${value}T12:00:00`))
}

function deliveryRange(value) {
  if (!value) return 'To be arranged'
  const start = new Date(`${value}T12:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 2)
  const formatter = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${formatter.format(start)} – ${formatter.format(end)}`
}

function placeOrder() {
  orderNumber.value = `CAR-${String(Date.now()).slice(-8)}`
  saveOrder({ number: orderNumber.value, items: items.value, checkout: checkout.value, total: total.value, placedAt: new Date().toISOString() })
  saveCart([])
  clearCheckout()
}

onMounted(() => {
  items.value = getCart()
  checkout.value = getCheckout()
})
</script>

<template>
  <main id="main" class="checkout-page checkout-review-page">
    <div class="checkout-titlebar"><a href="/" class="checkout-wordmark"><img src="/brand/caracole-logo.png" alt="Caracole" /><span>Secure checkout</span></a><div class="checkout-progress"><em>01 Checkout</em><span></span><b>02 Review</b></div></div>

    <section v-if="orderNumber" class="order-confirmed">
      <p class="eyebrow">Order received</p><h1>Thank you,<br />your home awaits.</h1><p>Your reference is <b>{{ orderNumber }}</b>. A confirmation will be prepared for the email address you provided.</p><a href="/products/living">Continue shopping →</a>
    </section>

    <section v-else-if="items.length && checkout" class="checkout-layout">
      <div class="review-content">
        <header><p class="eyebrow">Final consideration</p><h1>Review your order.</h1><p>Please confirm every detail before placing your order.</p></header>

        <section class="review-card"><div><span>01</span><h2>Contact &amp; delivery</h2><a href="/checkout#address">Edit</a></div><dl><dt>Name</dt><dd>{{ checkout.customer.firstName }} {{ checkout.customer.lastName }}</dd><dt>Contact</dt><dd>{{ checkout.customer.email }}<br />{{ checkout.customer.phone }}</dd><dt>Address</dt><dd>{{ checkout.customer.address }}<template v-if="checkout.customer.apartment">, {{ checkout.customer.apartment }}</template><br />{{ checkout.customer.city }}, {{ checkout.customer.province }} {{ checkout.customer.postalCode }}<br />{{ checkout.customer.country }}</dd></dl></section>

        <section class="review-card"><div><span>02</span><h2>Delivery schedule</h2><a href="/checkout#shipping">Edit</a></div><dl><dt>Method</dt><dd>{{ shippingNames[checkout.shippingMethod] }}</dd><dt>Preferred date</dt><dd>{{ displayDate(checkout.deliveryDate) }}</dd><dt>Estimated window</dt><dd>{{ deliveryRange(checkout.deliveryDate) }}</dd><dt>Time</dt><dd>{{ checkout.deliveryTime }}</dd></dl></section>

        <section class="review-card"><div><span>03</span><h2>Payment</h2><a href="/checkout#payment">Edit</a></div><dl><dt>Method</dt><dd>{{ paymentNames[checkout.paymentMethod] }}</dd><template v-if="checkout.paymentMethod === 'gcash'"><dt>Account</dt><dd>•••• {{ checkout.paymentDetails.gcashNumber?.slice(-4) || '—' }}</dd></template><template v-if="checkout.paymentMethod === 'card'"><dt>Card</dt><dd>•••• {{ checkout.paymentDetails.cardLastFour || '—' }}<br />{{ checkout.paymentDetails.cardholder }}</dd></template><template v-if="checkout.paymentMethod === 'flexible'"><dt>Provider</dt><dd>{{ checkout.paymentDetails.flexibleBank }}</dd><dt>Payment plan</dt><dd>{{ checkout.paymentTerm }} monthly installments<br />{{ formatCartPrice(total / Number(checkout.paymentTerm)) }} per month</dd></template><template v-if="checkout.paymentMethod === 'qrph'"><dt>Authorization</dt><dd>A one-time QR will appear after confirmation.</dd></template></dl></section>

        <button class="checkout-review-button" type="button" @click="placeOrder">Place order <span>→</span></button>
        <p class="checkout-terms">This demonstration does not submit a real payment or delivery request.</p>
      </div>

      <aside class="checkout-summary">
        <p class="eyebrow">Final order</p><h2>Your pieces</h2>
        <div class="checkout-summary__items"><article v-for="item in items" :key="item.edpNumber"><img :src="item.image" :alt="item.name" /><div><b>{{ item.name }}</b><small>Quantity {{ item.quantity }}</small></div><strong>{{ formatCartPrice(item.priceValue * item.quantity) }}</strong></article></div>
        <dl><div><dt>Subtotal</dt><dd>{{ formatCartPrice(subtotal) }}</dd></div><div><dt>Delivery</dt><dd>{{ checkout.shippingFee ? formatCartPrice(checkout.shippingFee) : 'Complimentary' }}</dd></div><div><dt>Total</dt><dd>{{ formatCartPrice(total) }}</dd></div></dl>
      </aside>
    </section>

    <section v-else class="checkout-empty"><p class="eyebrow">Review unavailable</p><h1>Your checkout<br />details are missing.</h1><a href="/cart">Return to cart →</a></section>
  </main>
</template>
