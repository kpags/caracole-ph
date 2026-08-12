<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'

const props = defineProps({
  product: { type: Object, required: true },
})

const activeIndex = ref(0)
let timer

const images = computed(() => [
  ...new Set([props.product.image, ...(props.product.images ?? [])].filter(Boolean)),
])

function start() {
  if (images.value.length < 2 || timer) return
  timer = window.setInterval(() => {
    activeIndex.value = (activeIndex.value + 1) % images.value.length
  }, 1000)
}

function stop() {
  window.clearInterval(timer)
  timer = undefined
  activeIndex.value = 0
}

onBeforeUnmount(stop)
</script>

<template>
  <span class="product-hover-images" @mouseenter="start" @mouseleave="stop">
    <img
      v-for="(image, index) in images"
      :key="image"
      :src="image"
      :alt="index === activeIndex ? product.name : ''"
      :aria-hidden="index !== activeIndex"
      :class="{ active: index === activeIndex }"
      loading="lazy"
    />
  </span>
</template>
