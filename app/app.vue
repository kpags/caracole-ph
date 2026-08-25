<script setup>
import StorefrontApp from '../src/App.vue'

useHead({
  htmlAttrs: { lang: 'en' },
  titleTemplate: (title) => title
    ? `${title} | Caracole Philippines`
    : 'Caracole Philippines — Modern Luxury, Made Personal',
  meta: [
    { name: 'theme-color', content: '#171715' },
    { name: 'description', content: 'Discover Caracole Philippines — artful furnishings, expressive rooms, and modern luxury made personal.' },
    { property: 'og:title', content: 'Caracole Philippines — Modern Luxury, Made Personal' },
    { property: 'og:description', content: 'Explore artful furnishings, expressive rooms, and the newest arrivals from Caracole Philippines.' },
    { property: 'og:type', content: 'website' },
    { property: 'og:image', content: '/og.png' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:image', content: '/og.png' },
  ],
  link: [{ rel: 'icon', href: '/brand/caracole-logo.png' }],
})
</script>

<template>
  <StorefrontApp />
</template>
