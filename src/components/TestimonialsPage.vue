<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const apiBaseUrl = (import.meta.env.VITE_API_URL || import.meta.env.NUXT_PUBLIC_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const stories = ref([])
const isLoading = ref(true)
const loadError = ref('')
const currentIndex = ref(0)
const videoElement = ref(null)
const progress = ref(0)
const activeStory = computed(() => stories.value[currentIndex.value] || null)
const IMAGE_SHOWCASE_DURATION = 5000
let imageAdvanceFrame = null

function clearImageAdvance() {
  if (imageAdvanceFrame !== null) window.cancelAnimationFrame(imageAdvanceFrame)
  imageAdvanceFrame = null
}

function playNext({ loop = true } = {}) {
  if (!stories.value.length) return
  progress.value = 0
  const nextIndex = currentIndex.value + 1
  if (nextIndex < stories.value.length) currentIndex.value = nextIndex
  else if (loop) currentIndex.value = 0
}

function scheduleImageAdvance() {
  clearImageAdvance()
  if (activeStory.value?.mediaType === 'video' || currentIndex.value >= stories.value.length - 1) return
  const startedAt = performance.now()
  const update = (now) => {
    const elapsed = now - startedAt
    progress.value = Math.min(100, (elapsed / IMAGE_SHOWCASE_DURATION) * 100)
    if (elapsed >= IMAGE_SHOWCASE_DURATION) {
      imageAdvanceFrame = null
      playNext({ loop: false })
      return
    }
    imageAdvanceFrame = window.requestAnimationFrame(update)
  }
  imageAdvanceFrame = window.requestAnimationFrame(update)
}

function updateProgress(event) {
  const { currentTime, duration } = event.currentTarget
  progress.value = duration ? Math.min(100, (currentTime / duration) * 100) : 0
}

async function selectSlide(index) {
  progress.value = 0
  if (index !== currentIndex.value) {
    currentIndex.value = index
    return
  }
  if (videoElement.value) {
    videoElement.value.currentTime = 0
    await videoElement.value.play().catch(() => {})
  } else {
    scheduleImageAdvance()
  }
}

async function loadTestimonials() {
  isLoading.value = true
  loadError.value = ''
  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/testimonials`)
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.message || 'Unable to load testimonials.')
    stories.value = body.testimonials || []
    currentIndex.value = 0
  } catch (error) {
    stories.value = []
    loadError.value = error.message || 'Unable to load testimonials.'
  } finally {
    isLoading.value = false
  }
}

watch(activeStory, async (story) => {
  clearImageAdvance()
  progress.value = 0
  await nextTick()
  if (story?.mediaType === 'video') {
    videoElement.value?.load()
    videoElement.value?.play().catch(() => {})
    return
  }
  if (story) scheduleImageAdvance()
})

onMounted(() => { void loadTestimonials() })
onBeforeUnmount(clearImageAdvance)
</script>

<template>
  <main id="main" class="testimonials-page">
    <section class="testimonials-intro">
      <p class="eyebrow">Caracole, at home</p>
      <h1>Homes with<br /><em>a story.</em></h1>
      <p>Step inside spaces shaped by Caracole and hear from the people who live with every considered detail.</p>
    </section>

    <section v-if="isLoading" class="testimonials-empty" aria-live="polite">
      <p class="eyebrow">In their words</p>
      <h2>Loading testimonials…</h2>
    </section>

    <section v-else-if="!activeStory" class="testimonials-empty" aria-live="polite">
      <p class="eyebrow">In their words</p>
      <h2>{{ loadError ? 'Testimonials are unavailable.' : 'No testimonials yet.' }}</h2>
      <button v-if="loadError" type="button" @click="loadTestimonials">Try again</button>
    </section>

    <section v-else class="testimonial-carousel" aria-live="polite" :aria-label="`Testimonial from ${activeStory.name}`">
      <div class="testimonial-film">
        <video
          v-if="activeStory.mediaType === 'video'"
          ref="videoElement"
          :key="activeStory.mediaContent"
          :src="activeStory.mediaContent"
          autoplay muted playsinline preload="metadata" tabindex="-1" aria-hidden="true"
          @ended="playNext" @timeupdate="updateProgress" @contextmenu.prevent
        ></video>
        <img v-else :src="activeStory.mediaContent" :alt="`${activeStory.name} testimonial`" />
        <div class="testimonial-film__shade"></div>
        <span>{{ String(currentIndex + 1).padStart(2, '0') }} / {{ String(stories.length).padStart(2, '0') }}</span>
      </div>

      <article class="testimonial-quote">
        <p class="eyebrow">In their words</p>
        <blockquote>“{{ activeStory.mainTestimony }}”</blockquote>
        <p>{{ activeStory.subTestimony }}</p>
        <footer>
          <strong>{{ activeStory.name }}</strong>
          <span>{{ activeStory.designation }}</span>
        </footer>
        <div class="testimonial-progress" role="group" aria-label="Choose a testimonial">
          <button
            v-for="(story, index) in stories"
            :key="story.id"
            type="button"
            :class="{ past: index < currentIndex, active: index === currentIndex }"
            :aria-label="`Show testimonial from ${story.name}`"
            :aria-current="index === currentIndex ? 'true' : undefined"
            @click="selectSlide(index)"
          ><i :style="index === currentIndex ? { width: `${progress}%` } : null"></i></button>
        </div>
        <small>Choose a chapter, or let images advance after five seconds and films continue when they end.</small>
      </article>
    </section>

    <section class="testimonials-closing">
      <p class="eyebrow">Made personal</p>
      <h2>Beautifully made.<br /><em>Meaningfully lived in.</em></h2>
      <a href="/products/living">Discover the collection <span>↗</span></a>
    </section>
  </main>
</template>
