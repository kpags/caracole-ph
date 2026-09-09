<script setup>
import { onMounted, ref } from 'vue'
import { clearCheckout } from '../data/checkout.js'
import { saveCart } from '../data/cart.js'
import { brandLogoUrl } from '../data/brand-logos.js'

const props = defineProps({ orderNumber: { type: String, default: '' }, token: { type: String, default: '' }, result: { type: String, default: '' } })
const state = ref('loading')
const message = ref('Confirming your payment with Caracole PH…')
const checkoutUrl = ref('')
const checkoutLogoUrl = brandLogoUrl('charcoal', useRuntimeConfig().public.mediaBaseUrl)
const apiBaseUrl = useRuntimeConfig().public.apiBaseUrl.replace(/\/$/, '')

async function refreshStatus() {
  if (!props.orderNumber || !props.token) { state.value = 'error'; message.value = 'This payment return link is incomplete.'; return }
  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/payments/orders/${encodeURIComponent(props.orderNumber)}/status?token=${encodeURIComponent(props.token)}`)
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.message || 'Unable to find this order.')
    checkoutUrl.value = body.order.checkoutUrl || ''
    if (body.order.paymentStatus === 'PAID') {
      checkoutUrl.value = ''; saveCart([]); clearCheckout(); state.value = 'paid'; message.value = `Payment confirmed for ${body.order.orderNumber}. Thank you for choosing Caracole PH.`
    } else if (props.result === 'cancel') {
      state.value = 'cancelled'; message.value = 'Your payment was not completed. Your cart and checkout details are still available.'
    } else {
      state.value = 'pending'; message.value = 'Your payment is still being confirmed. This page will refresh automatically.'
      window.setTimeout(refreshStatus, 3000)
    }
  } catch (error) { checkoutUrl.value = ''; state.value = 'error'; message.value = error.message || 'Unable to confirm payment status.' }
}
onMounted(refreshStatus)
</script>

<template>
  <main id="main" class="checkout-page checkout-return-page"><div class="checkout-titlebar"><a href="/" class="checkout-wordmark"><img :src="checkoutLogoUrl" alt="Caracole" /><span>Secure checkout</span></a></div><section class="order-confirmed"><p class="eyebrow">{{ state === 'paid' ? 'Payment confirmed' : state === 'cancelled' ? 'Payment not completed' : 'Payment status' }}</p><h1><template v-if="state === 'paid'">Thank you,<br />your home awaits.</template><template v-else-if="state === 'cancelled'">Your cart<br />is still waiting.</template><template v-else>Confirming your<br />payment.</template></h1><p>{{ message }}</p><i v-if="state === 'loading' || state === 'pending'" class="pi pi-spinner pi-spin" aria-label="Loading"></i><div v-if="state === 'cancelled'" class="checkout-return-page__actions"><a v-if="checkoutUrl" class="checkout-return-page__resume" :href="checkoutUrl">Continue to payment →</a><a href="/checkout/review">Return to review →</a></div><a v-else-if="state === 'paid'" href="/products/living">Continue shopping →</a><a v-else-if="state === 'error'" href="/cart">Return to cart →</a></section></main>
</template>
