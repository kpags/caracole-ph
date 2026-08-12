<script setup>
import { designers } from '../data/designers.js'
</script>

<template>
  <main id="main" class="designers-page">
    <header class="designers-page__intro">
      <div>
        <p class="eyebrow">The people behind the pieces</p>
        <h1>Meet the<br /><em>designers.</em></h1>
      </div>
      <p>Discover the creative perspectives, material curiosity, and considered details that give every Caracole collection its unmistakable point of view.</p>
    </header>

    <section class="designer-gallery" aria-label="Caracole designers">
      <a v-for="(designer, index) in designers" :key="designer.slug" class="designer-card" :href="`/designers/${designer.slug}`">
        <div class="designer-card__portrait">
          <img :src="designer.image" :alt="designer.name" />
          <span>{{ String(index + 1).padStart(2, '0') }}</span>
        </div>
        <div class="designer-card__copy">
          <p class="eyebrow">Designer profile</p>
          <h2>{{ designer.name }}</h2>
          <p>{{ designer.introDescription }}</p>
          <span>Discover their story <b>↗</b></span>
        </div>
      </a>
    </section>
  </main>
</template>
