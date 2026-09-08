<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { cartSubtotal, formatCartPrice, getCart } from '../data/cart.js'
import { getCheckout, saveCheckout } from '../data/checkout.js'
import { brandLogoUrl } from '../data/brand-logos.js'

const items = ref([])
const isGuestCheckout = ref(true)
const form = reactive({
  firstName: '', lastName: '', email: '', phone: '', address: '', apartment: '',
  city: '', province: '', postalCode: '', country: 'Philippines',
  shippingMethod: 'standard', deliveryDate: '', deliveryTime: '10:00–14:00',
  billingSame: true,
})

const shippingOptions = {
  standard: { name: 'Standard delivery', note: 'Carefully delivered to your address.', fee: 0 },
  whiteGlove: { name: 'White-glove delivery', note: 'Room-of-choice placement and packaging removal.', fee: 2500 },
  pickup: { name: 'Showroom collection', note: 'Collect from your selected Caracole PH showroom.', fee: 0 },
}
const subtotal = computed(() => cartSubtotal(items.value))
const shippingFee = computed(() => shippingOptions[form.shippingMethod].fee)
const total = computed(() => subtotal.value + shippingFee.value)
const checkoutLogoUrl = brandLogoUrl('charcoal', useRuntimeConfig().public.mediaBaseUrl)

function dateValue(offset) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().slice(0, 10)
}
const minimumDate = dateValue(3)
const maximumDate = dateValue(30)

function formatDeliveryDate(date) {
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

const estimatedDeliveryRange = computed(() => {
  if (!form.deliveryDate) return 'Select a preferred date'
  const start = new Date(`${form.deliveryDate}T12:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 2)
  return `${formatDeliveryDate(start)} – ${formatDeliveryDate(end)}`
})

function submit() {
  saveCheckout({
    customer: {
      firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone,
      address: form.address, apartment: form.apartment, city: form.city, province: form.province,
      postalCode: form.postalCode, country: form.country,
    },
    shippingMethod: form.shippingMethod,
    deliveryDate: form.deliveryDate,
    deliveryTime: form.deliveryTime,
    billingSame: form.billingSame,
    shippingFee: shippingFee.value,
    savedAt: new Date().toISOString(),
  })
  window.location.href = '/checkout/review'
}

onMounted(() => {
  items.value = getCart()
  form.deliveryDate = minimumDate
  const saved = getCheckout()
  isGuestCheckout.value = !localStorage.getItem('caracole-session')
  if (saved?.customer) Object.assign(form, saved.customer)
  if (saved) {
    form.shippingMethod = saved.shippingMethod || form.shippingMethod
    form.deliveryDate = saved.deliveryDate || form.deliveryDate
    form.deliveryTime = saved.deliveryTime || form.deliveryTime
    form.billingSame = saved.billingSame ?? true
  } else {
    try {
      const session = JSON.parse(localStorage.getItem('caracole-session') || 'null')
      if (session) {
        form.firstName = session.firstName || ''
        form.lastName = session.lastName || ''
        form.email = session.email || ''
      }
    } catch { /* Keep the form empty when the saved session is invalid. */ }
  }
})
</script>

<template>
  <main id="main" class="checkout-page">
    <div class="checkout-titlebar"><a href="/" class="checkout-wordmark"><img :src="checkoutLogoUrl" alt="Caracole" /><span>Secure checkout</span></a><div class="checkout-progress"><b>01 Checkout</b><span></span><em>02 Review</em></div></div>

    <section v-if="items.length" class="checkout-layout">
      <form class="checkout-form" @submit.prevent="submit">
        <header><p class="eyebrow">One considered step</p><h1>Complete your order.</h1><p>Delivery and payment details, composed in one simple page.</p><p v-if="isGuestCheckout" class="guest-checkout-note"><b>Checking out as a guest.</b> Your order history is stored only in this browser and is removed when its site data is cleared.</p></header>

        <fieldset id="address" class="checkout-section">
          <legend><span>01</span>Contact &amp; delivery</legend>
          <div class="checkout-fields checkout-fields--two">
            <label>First name<input v-model.trim="form.firstName" autocomplete="given-name" required /></label>
            <label>Last name<input v-model.trim="form.lastName" autocomplete="family-name" required /></label>
            <label>Email address<input v-model.trim="form.email" type="email" autocomplete="email" required /></label>
            <label>Phone number<input v-model.trim="form.phone" type="tel" autocomplete="tel" placeholder="+63" required /></label>
          </div>
          <div class="checkout-fields">
            <label>Address<input v-model.trim="form.address" autocomplete="street-address" required /></label>
            <label>Apartment, suite, etc. <small>Optional</small><input v-model.trim="form.apartment" /></label>
          </div>
          <div class="checkout-fields checkout-fields--three">
            <label>City<input v-model.trim="form.city" autocomplete="address-level2" required /></label>
            <label>Province<input v-model.trim="form.province" autocomplete="address-level1" required /></label>
            <label>Postal code<input v-model.trim="form.postalCode" inputmode="numeric" autocomplete="postal-code" required /></label>
          </div>
          <label class="checkout-country">Country<input v-model="form.country" readonly /></label>
        </fieldset>

        <fieldset id="shipping" class="checkout-section">
          <legend><span>02</span>Delivery</legend>
          <div class="checkout-options">
            <label v-for="(option, key) in shippingOptions" :key="key" :class="{ selected: form.shippingMethod === key }">
              <input v-model="form.shippingMethod" type="radio" :value="key" />
              <span><b>{{ option.name }}</b><small>{{ option.note }}</small></span>
              <strong>{{ option.fee ? formatCartPrice(option.fee) : 'Complimentary' }}</strong>
            </label>
          </div>
          <div class="checkout-fields checkout-fields--two checkout-schedule">
            <label>Preferred date<input v-model="form.deliveryDate" type="date" :min="minimumDate" :max="maximumDate" required /></label>
            <label>Preferred window<select v-model="form.deliveryTime"><option>10:00–14:00</option><option>14:00–18:00</option><option>Any time</option></select></label>
          </div>
          <div class="checkout-delivery-range" aria-live="polite"><span>Estimated delivery window</span><strong>{{ estimatedDeliveryRange }}</strong><p>Your preferred date begins a three-day delivery window, subject to final access and availability confirmation.</p></div>
        </fieldset>

        <fieldset id="payment" class="checkout-section">
          <legend><span>03</span>Payment</legend>
          <p class="checkout-secure">Payment details are collected only on PayMongo’s secure hosted checkout page after your order review.</p>
          <div class="payment-detail payment-detail--qr"><b>PayMongo Hosted Checkout</b><p>Available payment methods are securely shown by PayMongo based on the Caracole PH account.</p></div>
          <label class="checkout-checkbox"><input v-model="form.billingSame" type="checkbox" /> Billing address is the same as the delivery address</label>
        </fieldset>

        <button class="checkout-review-button" type="submit">Continue to review <span>→</span></button>
        <p class="checkout-terms">By continuing, you can review every detail before the order is placed.</p>
      </form>

      <aside class="checkout-summary">
        <p class="eyebrow">Your selection</p><h2>Order summary</h2>
        <div class="checkout-summary__items"><article v-for="item in items" :key="item.id"><img :src="item.image" :alt="item.name" /><div><b>{{ item.name }}</b><small>Quantity {{ item.quantity }}</small></div><strong>{{ formatCartPrice(item.priceValue * item.quantity) }}</strong></article></div>
        <dl><div><dt>Subtotal</dt><dd>{{ formatCartPrice(subtotal) }}</dd></div><div><dt>Delivery</dt><dd>{{ shippingFee ? formatCartPrice(shippingFee) : 'Complimentary' }}</dd></div><div><dt>Estimated total</dt><dd>{{ formatCartPrice(total) }}</dd></div></dl>
        <p class="checkout-summary__note">Taxes are included where applicable. Final delivery timing is confirmed after your order is placed.</p>
      </aside>
    </section>

    <section v-else class="checkout-empty"><p class="eyebrow">Your cart is empty</p><h1>There is nothing<br />to check out yet.</h1><a href="/products/living">Explore the collection →</a></section>
  </main>
</template>
