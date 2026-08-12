<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { addCartItem } from '../data/cart.js'
import { productCatalog } from '../data/catalog.js'
import { getWishlist, toggleWishlist, WISHLIST_EVENT } from '../data/wishlist.js'

const props = defineProps({ product: { type: Object, required: true } })

const currentImage = ref(0)
const quantity = ref(1)
const deliveryMethod = ref('standard')
const deliveryDate = ref('')
const deliveryTime = ref('10:00 AM – 1:00 PM')
const added = ref(false)
const recommendationsOpen = ref(false)
const recommendationClose = ref(null)
const recommendedAdded = ref(new Set())
const wishlistSet = ref(new Set())
const reviewsOpen = ref(false)
const reviewClose = ref(null)
const reviewPage = ref(1)
const inquiryOpen = ref(false)
const inquirySubmitted = ref(false)
const inquiryClose = ref(null)
const inquiryForm = reactive({ firstName: '', lastName: '', email: '', contactNumber: '', inquiry: '', captchaConfirmed: false })
const cartToast = ref('')
let cartToastTimer

const recommendationMap = {
  'Sofas & Loveseats': ['Sectionals', 'Side & End Tables', 'Center & Cocktail Tables', 'Cocktail Tables', 'Chairs', 'Benches & Ottomans'],
  Sectionals: ['Side & End Tables', 'Center & Cocktail Tables', 'Cocktail Tables', 'Chairs', 'Benches & Ottomans'],
  Beds: ['Nightstands', 'Chest Of Drawers', 'Dressers', 'Bed End Benches & Ottomans'],
  Nightstands: ['Beds', 'Dressers', 'Chest Of Drawers', 'Bed End Benches & Ottomans'],
  'Dining Chairs': ['Dining Tables', 'Dining Side Chairs', 'Dining Armchairs', 'Sideboards & Buffets'],
  'Dining Armchairs': ['Dining Tables', 'Dining Side Chairs', 'Dining Chairs', 'Sideboards & Buffets'],
  'Dining Side Chairs': ['Dining Tables', 'Dining Armchairs', 'Dining Chairs', 'Sideboards & Buffets'],
  'Dining Tables': ['Dining Chairs', 'Dining Side Chairs', 'Dining Armchairs', 'Sideboards & Buffets'],
  Chairs: ['Side & End Tables', 'Center & Cocktail Tables', 'Cocktail Tables', 'Sofas & Loveseats', 'Benches & Ottomans'],
  'Side & End Tables': ['Sofas & Loveseats', 'Chairs', 'Center & Cocktail Tables', 'Cocktail Tables'],
  'Center & Cocktail Tables': ['Sofas & Loveseats', 'Chairs', 'Side & End Tables', 'Benches & Ottomans'],
  'Cocktail Tables': ['Sofas & Loveseats', 'Chairs', 'Side & End Tables', 'Benches & Ottomans'],
  'Consoles & Desks': ['Chairs', 'Side & End Tables', 'Etageres & Shelves'],
  Dressers: ['Beds', 'Nightstands', 'Chest Of Drawers', 'Bed End Benches & Ottomans'],
  'Chest Of Drawers': ['Beds', 'Nightstands', 'Dressers', 'Bed End Benches & Ottomans'],
}

const images = computed(() => [...new Set([props.product.image, ...(props.product.images ?? [])].filter(Boolean))])
const description = computed(() => props.product.description && props.product.description !== '--' ? props.product.description : '')
const categorySlug = computed(() => ({
  Living: 'living', Dining: 'dining', Bedroom: 'bedroom',
  'Mirrors & Accessories': 'mirrors-accessories', Entertainment: 'entertainment',
})[props.product.displayCategory] ?? 'living')
const productListingHref = computed(() => {
  const subcategory = props.product.subcategory && props.product.subcategory !== '--'
    ? `?subcategory=${encodeURIComponent(props.product.subcategory)}`
    : ''
  return `/products/${categorySlug.value}${subcategory}`
})

const productReviews = computed(() => [
  { name: 'Isabella R.', date: 'July 2026', rating: 5, title: 'Quietly exceptional', body: `${props.product.name} has a refined presence without overwhelming the room. The proportions feel considered, and the finish looks beautiful throughout the day.` },
  { name: 'Miguel A.', date: 'June 2026', rating: 5, title: 'Beautiful from every angle', body: `The craftsmanship is what stood out first. This ${props.product.subcategory && props.product.subcategory !== '--' ? props.product.subcategory.toLowerCase() : 'piece'} feels substantial, comfortable in the space, and distinctly Caracole.` },
  { name: 'Camille S.', date: 'May 2026', rating: 4, title: 'A polished focal point', body: `It brought the room together immediately. The details are subtle in photographs, but in person they give ${props.product.name} a wonderfully luxurious character.` },
  { name: 'Andrea L.', date: 'April 2026', rating: 5, title: 'Worth the wait', body: 'The delivery coordination was thoughtful and the piece arrived beautifully presented. It feels timeless, well made, and easy to style with the rest of our home.' },
  { name: 'Patricia M.', date: 'March 2026', rating: 5, title: 'A lasting first impression', body: `${props.product.name} immediately gave our room a more composed feeling. The form is distinctive, yet it works effortlessly with the pieces we already own.` },
  { name: 'Rafael C.', date: 'February 2026', rating: 5, title: 'Refined and versatile', body: 'The scale is just right and the finish has a lovely depth. It has become one of those pieces that guests notice without it ever feeling showy.' },
  { name: 'Sofia T.', date: 'January 2026', rating: 4, title: 'Considered in every detail', body: 'From the silhouette to the smaller finishing details, everything feels intentional. The showroom team was also helpful in confirming how it would sit in our space.' },
  { name: 'Gabriel V.', date: 'December 2025', rating: 5, title: 'Understated luxury', body: `We chose ${props.product.name} for its clean character, and it looks even better at home. It adds warmth and polish without making the room feel overly formal.` },
  { name: 'Bianca P.', date: 'November 2025', rating: 5, title: 'A beautiful addition', body: 'The piece feels substantial and beautifully finished. Styling it was simple because the design has enough personality to stand on its own.' },
  { name: 'Enrique D.', date: 'October 2025', rating: 5, title: 'Exactly what the room needed', body: 'It balances comfort and elegance remarkably well. The proportions work beautifully and the quality is apparent from every angle.' },
  { name: 'Lucia F.', date: 'September 2025', rating: 5, title: 'Timeless character', body: `There is a quiet confidence to ${props.product.name}. It feels current now, but the design is considered enough that we know it will remain relevant for years.` },
  { name: 'Marco J.', date: 'August 2025', rating: 4, title: 'Thoughtfully made', body: 'A polished, well-proportioned piece with excellent visual presence. The whole selection and delivery experience felt attentive from beginning to end.' },
])
const visibleProductReviews = computed(() => productReviews.value.slice(0, 4))
const reviewPageCount = computed(() => Math.ceil(productReviews.value.length / 10))
const paginatedReviews = computed(() => productReviews.value.slice((reviewPage.value - 1) * 10, reviewPage.value * 10))
const reviewAverage = computed(() => (productReviews.value.reduce((sum, review) => sum + review.rating, 0) / productReviews.value.length).toFixed(1))

const recommendations = computed(() => {
  const desired = recommendationMap[props.product.subcategory] ?? []
  const groups = desired.map((subcategory) => productCatalog.filter((candidate) =>
    candidate.edpNumber !== props.product.edpNumber
    && candidate.displayCategory === props.product.displayCategory
    && candidate.subcategory === subcategory
    && candidate.image
  ))
  const selected = []
  let round = 0

  while (selected.length < 5 && groups.some((group) => group[round])) {
    groups.forEach((group) => {
      if (selected.length < 5 && group[round]) selected.push(group[round])
    })
    round += 1
  }

  if (selected.length < 5) {
    const fallback = productCatalog.filter((candidate) =>
      candidate.edpNumber !== props.product.edpNumber
      && candidate.displayCategory === props.product.displayCategory
      && candidate.subcategory !== '--'
      && candidate.image
      && !selected.some((item) => item.edpNumber === candidate.edpNumber)
    )
    selected.push(...fallback.slice(0, 5 - selected.length))
  }

  if (selected.length < 5) {
    const collectionFallback = productCatalog.filter((candidate) =>
      candidate.edpNumber !== props.product.edpNumber
      && candidate.subcategory !== '--'
      && candidate.image
      && !selected.some((item) => item.edpNumber === candidate.edpNumber)
    )
    selected.push(...collectionFallback.slice(0, 5 - selected.length))
  }

  return selected.slice(0, 5)
})

const detailRows = computed(() => [
  ['Series', props.product.series],
  ['Article number', props.product.articleNumber],
  ['EDP number', props.product.edpNumber],
  ['Category', props.product.displayCategory],
  ['Subcategory', props.product.subcategory],
  ['Finish', props.product.finish],
  ['Size', props.product.size],
].filter(([, value]) => value && value !== '--'))

function addDays(days) {
  const value = new Date()
  value.setHours(12, 0, 0, 0)
  value.setDate(value.getDate() + days)
  return value
}

function inputDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function displayDate(date) {
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

const deliveryStart = addDays(3)
const deliveryEnd = addDays(5)
const minDeliveryDate = inputDate(deliveryStart)
const maxDeliveryDate = inputDate(addDays(30))
const estimatedDelivery = `${displayDate(deliveryStart)} – ${displayDate(deliveryEnd)}`
deliveryDate.value = minDeliveryDate

function formatPrice() {
  const value = Number(props.product.priceValue)
  return value
    ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value)
    : 'Price upon request'
}

function formatRecommendationPrice(product) {
  const value = Number(product.priceValue)
  return value
    ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value)
    : 'Price upon request'
}

function changeQuantity(amount) {
  quantity.value = Math.max(1, Math.min(99, quantity.value + amount))
}

function addToCart() {
  addCartItem(props.product, quantity.value)
  added.value = true
  showCartToast(props.product.name)
  recommendationsOpen.value = true
  nextTick(() => recommendationClose.value?.focus())
  window.setTimeout(() => { added.value = false }, 2200)
}

function addRecommendation(product) {
  addCartItem(product, 1)
  recommendedAdded.value = new Set([...recommendedAdded.value, product.edpNumber])
  showCartToast(product.name)
}

function updateWishlist(product) {
  wishlistSet.value = new Set(toggleWishlist(product.edpNumber))
}

function refreshWishlist() {
  wishlistSet.value = new Set(getWishlist())
}

function showCartToast(productName) {
  window.clearTimeout(cartToastTimer)
  cartToast.value = productName
  cartToastTimer = window.setTimeout(() => { cartToast.value = '' }, 3200)
}

function closeRecommendations() {
  recommendationsOpen.value = false
}

function openReviews() {
  reviewPage.value = 1
  reviewsOpen.value = true
  nextTick(() => reviewClose.value?.focus())
}

function closeReviews() {
  reviewsOpen.value = false
}

function openInquiry() {
  inquirySubmitted.value = false
  try {
    const session = JSON.parse(localStorage.getItem('caracole-session') || 'null')
    if (session) {
      inquiryForm.firstName = inquiryForm.firstName || session.firstName || ''
      inquiryForm.lastName = inquiryForm.lastName || session.lastName || ''
      inquiryForm.email = inquiryForm.email || session.email || ''
    }
  } catch { /* Keep the inquiry fields empty for guests. */ }
  inquiryOpen.value = true
  nextTick(() => inquiryClose.value?.focus())
}

function closeInquiry() {
  inquiryOpen.value = false
  inquirySubmitted.value = false
}

function submitInquiry() {
  const submission = { ...inquiryForm, productName: props.product.name, edpNumber: props.product.edpNumber, submittedAt: new Date().toISOString() }
  try {
    const inquiries = JSON.parse(localStorage.getItem('caracole-product-inquiries') || '[]')
    inquiries.push(submission)
    localStorage.setItem('caracole-product-inquiries', JSON.stringify(inquiries))
  } catch {
    localStorage.setItem('caracole-product-inquiries', JSON.stringify([submission]))
  }
  inquirySubmitted.value = true
}

function handleEscape(event) {
  if (event.key === 'Escape' && recommendationsOpen.value) closeRecommendations()
  if (event.key === 'Escape' && reviewsOpen.value) closeReviews()
  if (event.key === 'Escape' && inquiryOpen.value) closeInquiry()
}

onMounted(() => {
  window.addEventListener('keydown', handleEscape)
  window.addEventListener(WISHLIST_EVENT, refreshWishlist)
  refreshWishlist()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleEscape)
  window.removeEventListener(WISHLIST_EVENT, refreshWishlist)
  window.clearTimeout(cartToastTimer)
})
</script>

<template>
  <main id="main" class="product-page">
    <div class="product-breadcrumb">
      <a href="/">Home</a><span>/</span>
      <a :href="`/products/${categorySlug}`">{{ product.displayCategory }}</a><span>/</span>
      <span>{{ product.name }}</span>
    </div>

    <section class="product-intro">
      <div class="product-gallery">
        <div class="product-gallery__stage">
          <img :key="images[currentImage]" :src="images[currentImage]" :alt="`${product.name} view ${currentImage + 1}`" />
          <span class="product-gallery__count">{{ String(currentImage + 1).padStart(2, '0') }} / {{ String(images.length).padStart(2, '0') }}</span>
          <button v-if="images.length > 1" class="product-gallery__arrow product-gallery__arrow--prev" type="button" aria-label="Previous image" @click="currentImage = (currentImage - 1 + images.length) % images.length">←</button>
          <button v-if="images.length > 1" class="product-gallery__arrow product-gallery__arrow--next" type="button" aria-label="Next image" @click="currentImage = (currentImage + 1) % images.length">→</button>
        </div>
        <div v-if="images.length > 1" class="product-gallery__thumbs" aria-label="Product images">
          <button v-for="(image, index) in images" :key="image" type="button" :class="{ active: currentImage === index }" :aria-label="`Show image ${index + 1}`" :aria-current="currentImage === index" @click="currentImage = index">
            <img :src="image" alt="" loading="lazy" /><span>{{ String(index + 1).padStart(2, '0') }}</span>
          </button>
        </div>
      </div>

      <div class="product-buybox">
        <div class="product-buybox__heading">
          <p class="eyebrow">{{ product.series && product.series !== '--' ? product.series : 'Caracole' }}</p>
          <div class="product-badges"><span v-if="product.isNewArrival">New arrival</span><span v-if="product.isComingSoon">Coming soon</span></div>
          <h1>{{ product.name }}</h1>
          <p class="product-price">{{ formatPrice() }}</p>
          <p v-if="product.articleNumber && product.articleNumber !== '--'" class="product-reference">Article {{ product.articleNumber }}</p>
        </div>

        <div class="delivery-estimate">
          <span>Estimated delivery</span><strong>{{ estimatedDelivery }}</strong>
          <p>Available throughout Metro Manila. Final timing is confirmed by our delivery team.</p>
        </div>

        <fieldset class="delivery-options">
          <legend>Delivery option</legend>
          <label v-for="option in [{ value: 'standard', title: 'Standard delivery', copy: 'Carefully delivered to your address.' }, { value: 'white-glove', title: 'White-glove delivery', copy: 'Room placement and packaging removal.' }, { value: 'pickup', title: 'Showroom pickup', copy: 'Collect from GH Mall, San Juan.' }]" :key="option.value" :class="{ selected: deliveryMethod === option.value }">
            <input v-model="deliveryMethod" type="radio" name="delivery" :value="option.value" />
            <span><b>{{ option.title }}</b><small>{{ option.copy }}</small></span><i>{{ option.value === 'standard' ? 'Complimentary' : option.value === 'pickup' ? 'By appointment' : 'Quoted separately' }}</i>
          </label>
        </fieldset>

        <div class="delivery-schedule">
          <label><span>Preferred date</span><input v-model="deliveryDate" type="date" :min="minDeliveryDate" :max="maxDeliveryDate" /></label>
          <label><span>Preferred schedule</span><select v-model="deliveryTime"><option>10:00 AM – 1:00 PM</option><option>1:00 PM – 4:00 PM</option><option>4:00 PM – 7:00 PM</option></select></label>
        </div>

        <div class="purchase-actions">
          <div class="quantity-control" aria-label="Quantity selector">
            <button type="button" aria-label="Decrease quantity" @click="changeQuantity(-1)">−</button>
            <input v-model.number="quantity" type="number" min="1" max="99" aria-label="Quantity" />
            <button type="button" aria-label="Increase quantity" @click="changeQuantity(1)">+</button>
          </div>
          <button class="add-to-cart" type="button" @click="addToCart">{{ added ? `Added ${quantity} to cart ✓` : 'Add to cart' }}</button>
        </div>
        <button class="product-inquire-button" type="button" @click="openInquiry">Inquire about this product</button>
        <p class="purchase-note">A Caracole specialist will confirm availability, delivery access, and your selected schedule after checkout.</p>
      </div>
    </section>

    <section class="product-story">
      <div v-if="description" class="product-story__description">
        <p class="eyebrow">Design details</p>
        <h2>Made to be<br /><em>remembered.</em></h2>
        <p>{{ description }}</p>
      </div>
      <div v-if="detailRows.length" class="product-specifications">
        <p class="eyebrow">Product information</p>
        <h2>Details</h2>
        <dl><template v-for="([label, value]) in detailRows" :key="label"><dt>{{ label }}</dt><dd>{{ value }}</dd></template></dl>
      </div>
    </section>

    <section v-if="images.length > 1" class="product-lifestyle">
      <div><p class="eyebrow light">In the room</p><h2>See it in<br />a different light.</h2></div>
      <img :src="images[1]" :alt="`${product.name} styled in an interior`" loading="lazy" />
    </section>

    <section class="product-reviews" aria-labelledby="product-reviews-title">
      <header>
        <div><p class="eyebrow">Client impressions</p><h2 id="product-reviews-title">Loved at home.</h2></div>
        <div class="product-reviews__summary"><strong>{{ reviewAverage }}</strong><span :aria-label="`${reviewAverage} out of 5 stars`">★★★★★</span><small>Based on {{ productReviews.length }} reviews</small></div>
      </header>
      <div class="product-reviews__grid">
        <article v-for="review in visibleProductReviews" :key="review.name">
          <div><span :aria-label="`${review.rating} out of 5 stars`">{{ '★'.repeat(review.rating) }}<i aria-hidden="true">{{ '★'.repeat(5 - review.rating) }}</i></span><time>{{ review.date }}</time></div>
          <h3>{{ review.title }}</h3><p>{{ review.body }}</p><footer>{{ review.name }} <small>Verified client</small></footer>
        </article>
      </div>
      <button v-if="productReviews.length > 4" class="product-reviews__more" type="button" @click="openReviews">See more reviews <span>{{ productReviews.length }}</span></button>
    </section>

    <section v-if="recommendations.length" class="related-products" aria-labelledby="related-products-title">
      <header><div><p class="eyebrow">Complete the room</p><h2 id="related-products-title">Frequently Bought Together</h2></div><p>Pieces selected to live beautifully alongside {{ product.name }}.</p></header>
      <div class="related-products__grid">
        <article v-for="item in recommendations" :key="item.edpNumber" class="related-product-card">
          <a class="related-product-card__image" :href="`/product/${encodeURIComponent(item.edpNumber)}`"><img :src="item.image" :alt="item.name" loading="lazy" /><i>View product →</i></a>
          <span class="related-product-card__copy"><small>{{ item.subcategory }}</small><a :href="`/product/${encodeURIComponent(item.edpNumber)}`"><b>{{ item.name }}</b></a><strong>{{ formatRecommendationPrice(item) }}</strong></span>
          <button class="wishlist-heart related-product-card__wishlist" type="button" :class="{ active: wishlistSet.has(item.edpNumber) }" :aria-label="wishlistSet.has(item.edpNumber) ? `Remove ${item.name} from wishlist` : `Add ${item.name} to wishlist`" @click="updateWishlist(item)"><span aria-hidden="true">{{ wishlistSet.has(item.edpNumber) ? '♥' : '♡' }}</span></button>
        </article>
      </div>
    </section>

    <Teleport to="body">
      <Transition name="cart-toast">
        <div v-if="cartToast" class="cart-success-toast" role="status" aria-live="polite">
          <span class="cart-success-toast__icon" aria-hidden="true">✓</span>
          <div><b>Successfully added to cart</b><p>{{ cartToast }}</p></div>
          <button type="button" aria-label="Dismiss notification" @click="cartToast = ''">×</button>
        </div>
      </Transition>
      <div v-if="recommendationsOpen" class="recommendation-backdrop" @click.self="closeRecommendations">
        <section class="recommendation-modal" role="dialog" aria-modal="true" aria-labelledby="recommendation-title">
          <button ref="recommendationClose" class="recommendation-modal__close" type="button" aria-label="Close recommendations" @click="closeRecommendations">×</button>
          <header><p class="eyebrow">Complete the room</p><h2 id="recommendation-title">You May Also Like</h2><p>Selected to complement {{ product.name }}.</p></header>
          <div v-if="recommendations.length" class="recommendation-grid">
            <article v-for="item in recommendations" :key="item.edpNumber" class="recommendation-card">
              <a :href="`/product/${encodeURIComponent(item.edpNumber)}`" class="recommendation-card__image"><img :src="item.image" :alt="item.name" loading="lazy" /></a>
              <button class="wishlist-heart recommendation-card__wishlist" type="button" :class="{ active: wishlistSet.has(item.edpNumber) }" :aria-label="wishlistSet.has(item.edpNumber) ? `Remove ${item.name} from wishlist` : `Add ${item.name} to wishlist`" @click="updateWishlist(item)"><span aria-hidden="true">{{ wishlistSet.has(item.edpNumber) ? '♥' : '♡' }}</span></button>
              <div class="recommendation-card__copy"><p>{{ item.subcategory }}</p><a :href="`/product/${encodeURIComponent(item.edpNumber)}`">{{ item.name }}</a><strong>{{ formatRecommendationPrice(item) }}</strong></div>
              <button class="recommendation-card__add" type="button" :disabled="recommendedAdded.has(item.edpNumber)" @click="addRecommendation(item)">{{ recommendedAdded.has(item.edpNumber) ? 'Added ✓' : 'Add to cart' }}</button>
            </article>
          </div>
          <p v-else class="recommendation-empty">Explore more considered pieces from the Caracole collection.</p>
          <a class="recommendation-return" :href="productListingHref">Return product listing</a>
        </section>
      </div>
      <div v-if="reviewsOpen" class="review-modal-backdrop" @click.self="closeReviews">
        <section class="review-modal" role="dialog" aria-modal="true" aria-labelledby="all-reviews-title">
          <button ref="reviewClose" class="review-modal__close" type="button" aria-label="Close reviews" @click="closeReviews">×</button>
          <header><p class="eyebrow">Client impressions</p><h2 id="all-reviews-title">Reviews for<br />{{ product.name }}</h2><p>{{ reviewAverage }} out of 5 · {{ productReviews.length }} reviews</p></header>
          <div class="review-comments">
            <article v-for="review in paginatedReviews" :key="review.name">
              <div class="review-comment__identity"><span>{{ review.name.split(' ').map((part) => part[0]).join('') }}</span><div><b>{{ review.name }}</b><small>Verified client · {{ review.date }}</small></div></div>
              <div class="review-comment__body"><span :aria-label="`${review.rating} out of 5 stars`">{{ '★'.repeat(review.rating) }}<i aria-hidden="true">{{ '★'.repeat(5 - review.rating) }}</i></span><p>{{ review.body }}</p></div>
            </article>
          </div>
          <nav v-if="reviewPageCount > 1" class="review-pagination" aria-label="Review pages"><button v-for="page in reviewPageCount" :key="page" type="button" :class="{ active: reviewPage === page }" :aria-current="reviewPage === page ? 'page' : undefined" @click="reviewPage = page">{{ String(page).padStart(2, '0') }}</button></nav>
        </section>
      </div>
      <div v-if="inquiryOpen" class="inquiry-modal-backdrop" @click.self="closeInquiry">
        <section class="inquiry-modal" role="dialog" aria-modal="true" aria-labelledby="product-inquiry-title">
          <button ref="inquiryClose" class="inquiry-modal__close" type="button" aria-label="Close product inquiry" @click="closeInquiry">×</button>
          <div v-if="inquirySubmitted" class="inquiry-modal__success"><span aria-hidden="true">✓</span><p class="eyebrow">Inquiry received</p><h2 id="product-inquiry-title">We will be<br />in touch.</h2><p>A Caracole PH specialist will respond with more information about {{ product.name }}.</p><button type="button" @click="closeInquiry">Continue viewing product</button></div>
          <template v-else><header><p class="eyebrow">Product inquiry</p><h2 id="product-inquiry-title">Ask about<br />{{ product.name }}</h2><p>Want to know more about this product? Send us an inquiry.</p></header>
          <form class="inquiry-form" @submit.prevent="submitInquiry"><div class="inquiry-fields"><label><span>First name</span><input v-model.trim="inquiryForm.firstName" autocomplete="given-name" required /></label><label><span>Last name</span><input v-model.trim="inquiryForm.lastName" autocomplete="family-name" required /></label><label><span>Email</span><input v-model.trim="inquiryForm.email" type="email" autocomplete="email" required /></label><label><span>Contact number</span><input v-model.trim="inquiryForm.contactNumber" type="tel" autocomplete="tel" required /></label></div><label><span>Enter your inquiry</span><textarea v-model.trim="inquiryForm.inquiry" required></textarea></label><div class="inquiry-form__foot"><label class="inquiry-captcha"><input v-model="inquiryForm.captchaConfirmed" type="checkbox" required /><span><b>I'm not a robot</b><small>Prototype verification</small></span><i aria-hidden="true">✓</i></label><button type="submit">Send inquiry</button></div></form></template>
        </section>
      </div>
    </Teleport>
  </main>
</template>
