<script setup>
import { computed, onMounted, ref } from 'vue'
import { cartSubtotal, formatCartPrice, getCart, saveCart } from '../data/cart.js'
import { clearCheckout, getCheckout } from '../data/checkout.js'
import { brandLogoUrl } from '../data/brand-logos.js'

const items = ref([])
const checkout = ref(null)
const paymentError = ref('')
const isStartingPayment = ref(false)
const subtotal = computed(() => cartSubtotal(items.value))
const total = computed(() => subtotal.value + Number(checkout.value?.shippingFee || 0))
const shippingNames = { standard: 'Standard delivery', whiteGlove: 'White-glove delivery', pickup: 'Showroom collection' }
const checkoutLogoUrl = brandLogoUrl('charcoal', useRuntimeConfig().public.mediaBaseUrl)
const apiBaseUrl = useRuntimeConfig().public.apiBaseUrl.replace(/\/$/, '')

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

async function startPayment() {
  if (isStartingPayment.value) return
  isStartingPayment.value = true
  paymentError.value = ''
  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/payments/checkout`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: items.value.map(({ id, quantity }) => ({ id, quantity })),
        checkout: {
          customer: checkout.value.customer,
          shippingMethod: checkout.value.shippingMethod,
          deliveryDate: checkout.value.deliveryDate,
          deliveryTime: checkout.value.deliveryTime
        }
      })
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok || !body.checkoutUrl) throw new Error(body.message || 'Unable to begin secure payment.')
    window.location.assign(body.checkoutUrl)
  } catch (error) {
    paymentError.value = error.message || 'Unable to begin secure payment.'
    isStartingPayment.value = false
  }
}

onMounted(() => {
  items.value = getCart()
  checkout.value = getCheckout()
})
</script>

<template>
  <main id="main" class="checkout-page checkout-review-page">
    <div class="checkout-titlebar"><a href="/" class="checkout-wordmark"><img :src="checkoutLogoUrl" alt="Caracole" /><span>Secure checkout</span></a><div class="checkout-progress"><em>01 Checkout</em><span></span><b>02 Review</b></div></div>

    <section v-if="items.length && checkout" class="checkout-layout">
      <div class="review-content">
        <header><p class="eyebrow">Final consideration</p><h1>Review your order.</h1><p>Please confirm every detail before placing your order.</p></header>

        <section class="review-card"><div><span>01</span><h2>Contact &amp; delivery</h2><a href="/checkout#address">Edit</a></div><dl><dt>Name</dt><dd>{{ checkout.customer.firstName }} {{ checkout.customer.lastName }}</dd><dt>Contact</dt><dd>{{ checkout.customer.email }}<br />{{ checkout.customer.phone }}</dd><dt>Address</dt><dd>{{ checkout.customer.address }}<template v-if="checkout.customer.apartment">, {{ checkout.customer.apartment }}</template><br />{{ checkout.customer.city }}, {{ checkout.customer.province }} {{ checkout.customer.postalCode }}<br />{{ checkout.customer.country }}</dd></dl></section>

        <section class="review-card"><div><span>02</span><h2>Delivery schedule</h2><a href="/checkout#shipping">Edit</a></div><dl><dt>Method</dt><dd>{{ shippingNames[checkout.shippingMethod] }}</dd><dt>Preferred date</dt><dd>{{ displayDate(checkout.deliveryDate) }}</dd><dt>Estimated window</dt><dd>{{ deliveryRange(checkout.deliveryDate) }}</dd><dt>Time</dt><dd>{{ checkout.deliveryTime }}</dd></dl></section>

        <section class="review-card"><div><span>03</span><h2>Secure payment</h2><a href="/checkout#payment">Edit</a></div><dl><dt>Gateway</dt><dd>PayMongo Hosted Checkout</dd><dt>Payment methods</dt><dd>Select any available option securely on the PayMongo payment page.</dd><dt>Receipt</dt><dd>PayMongo will email a receipt when enabled by Caracole PH.</dd></dl></section>

        <p v-if="paymentError" class="checkout-terms checkout-terms--error" role="alert">{{ paymentError }}</p>
        <button class="checkout-review-button" type="button" :disabled="isStartingPayment" @click="startPayment">{{ isStartingPayment ? 'Redirecting securely…' : 'Continue to secure payment' }} <span>→</span></button>
        <p class="checkout-terms">You will be redirected to PayMongo to complete your payment securely.</p>
      </div>

      <aside class="checkout-summary">
        <p class="eyebrow">Final order</p><h2>Your pieces</h2>
        <div class="checkout-summary__items"><article v-for="item in items" :key="item.id"><img :src="item.image" :alt="item.name" /><div><b>{{ item.name }}</b><small>Quantity {{ item.quantity }}</small></div><strong>{{ formatCartPrice(item.priceValue * item.quantity) }}</strong></article></div>
        <dl><div><dt>Subtotal</dt><dd>{{ formatCartPrice(subtotal) }}</dd></div><div><dt>Delivery</dt><dd>{{ checkout.shippingFee ? formatCartPrice(checkout.shippingFee) : 'Complimentary' }}</dd></div><div><dt>Total</dt><dd>{{ formatCartPrice(total) }}</dd></div></dl>
      </aside>
    </section>

    <section v-else class="checkout-empty"><p class="eyebrow">Review unavailable</p><h1>Your checkout<br />details are missing.</h1><a href="/cart">Return to cart →</a></section>
  </main>
</template>
