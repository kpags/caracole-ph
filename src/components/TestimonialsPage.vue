<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import joseOne from '../../assets/testimonials/jose_chan/video_1.mp4'
import joseTwo from '../../assets/testimonials/jose_chan/video_2.mp4'
import mariaOne from '../../assets/testimonials/maria_chan/video_1.mp4'
import mariaTwo from '../../assets/testimonials/maria_chan/video_2.mp4'
import coupleOne from '../../assets/testimonials/mr_and_mrs_chan/video_1.mp4'
import coupleTwo from '../../assets/testimonials/mr_and_mrs_chan/video_2.mp4'

const stories = [
  {
    name: 'Jose Chan',
    role: 'Caracole PH Client',
    quote: '“Caracole transformed the room into something expressive, comfortable, and unmistakably ours.”',
    copy: 'Every silhouette feels considered, from the sculptural forms to the finishes that catch the light. The quality is felt every day, not only seen.',
    videos: [joseOne, joseTwo],
  },
  {
    name: 'Maria Chan',
    role: 'Caracole PH Client',
    quote: '“The collection brings the polish of a beautiful hotel into a home that still feels completely personal.”',
    copy: 'Caracole made it easy to layer statement pieces with warmth and ease. The result is refined, welcoming, and made for real life.',
    videos: [mariaOne, mariaTwo],
  },
  {
    name: 'Mr. & Mrs. Chan',
    role: 'Caracole PH Clients',
    quote: '“We wanted rooms that felt collected over time. Caracole gave us that sense of character from the very first piece.”',
    copy: 'The craftsmanship, comfort, and thoughtful proportions made every choice feel lasting. Our home now feels complete without ever feeling overdone.',
    videos: [coupleOne, coupleTwo],
  },
]

const slides = stories.flatMap((story) => story.videos.map((video, chapter) => ({ ...story, video, chapter })))
const currentIndex = ref(0)
const videoElement = ref(null)
const progress = ref(0)
const activeStory = computed(() => slides[currentIndex.value])

function playNext() {
  progress.value = 0
  currentIndex.value = (currentIndex.value + 1) % slides.length
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
  }
}

watch(currentIndex, async () => {
  await nextTick()
  videoElement.value?.load()
  videoElement.value?.play().catch(() => {})
})
</script>

<template>
  <main id="main" class="testimonials-page">
    <section class="testimonials-intro">
      <p class="eyebrow">Caracole, at home</p>
      <h1>Homes with<br /><em>a story.</em></h1>
      <p>Step inside spaces shaped by Caracole and hear from the people who live with every considered detail.</p>
    </section>

    <section class="testimonial-carousel" aria-live="polite" :aria-label="`Testimonial from ${activeStory.name}`">
      <div class="testimonial-film">
        <video
          ref="videoElement"
          :key="activeStory.video"
          :src="activeStory.video"
          autoplay
          muted
          playsinline
          preload="metadata"
          tabindex="-1"
          aria-hidden="true"
          @ended="playNext"
          @timeupdate="updateProgress"
          @contextmenu.prevent
        ></video>
        <div class="testimonial-film__shade"></div>
        <span>{{ String(currentIndex + 1).padStart(2, '0') }} / {{ String(slides.length).padStart(2, '0') }}</span>
      </div>

      <article class="testimonial-quote">
        <p class="eyebrow">In their words</p>
        <blockquote>{{ activeStory.quote }}</blockquote>
        <p>{{ activeStory.copy }}</p>
        <footer>
          <strong>{{ activeStory.name }}</strong>
          <span>{{ activeStory.role }}</span>
        </footer>
        <div class="testimonial-progress" role="group" aria-label="Choose a testimonial">
          <button
            v-for="(slide, index) in slides"
            :key="`${slide.name}-${slide.chapter}`"
            type="button"
            :class="{ past: index < currentIndex, active: index === currentIndex }"
            :aria-label="`Play ${slide.name} testimonial, film ${slide.chapter + 1}`"
            :aria-current="index === currentIndex ? 'true' : undefined"
            @click="selectSlide(index)"
          >
            <i :style="index === currentIndex ? { width: `${progress}%` } : null"></i>
          </button>
        </div>
        <small>Choose a chapter or let each story continue when the film ends.</small>
      </article>
    </section>

    <section class="testimonials-closing">
      <p class="eyebrow">Made personal</p>
      <h2>Beautifully made.<br /><em>Meaningfully lived in.</em></h2>
      <a href="/products/living">Discover the collection <span>↗</span></a>
    </section>
  </main>
</template>
