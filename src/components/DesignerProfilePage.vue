<script setup>
defineProps({
  designer: {
    type: Object,
    required: true,
  },
})
</script>

<template>
  <main id="main" class="designer-profile">
    <section class="designer-profile__hero">
      <img :src="designer.banner" :alt="`${designer.name} at work`" />
      <div class="designer-profile__shade"></div>
      <div class="designer-profile__hero-copy">
        <p class="eyebrow light">Caracole designer</p>
        <h1>{{ designer.name }}</h1>
        <p>{{ designer.introDescription }}</p>
      </div>
      <span class="designer-profile__index">The creative perspective</span>
    </section>

    <section class="designer-profile__story">
      <div>
        <p class="eyebrow">Profile</p>
        <h2>A vision shaped<br />through detail.</h2>
      </div>
      <div>
        <p>{{ designer.profileDescription }}</p>
        <a :href="designer.link" target="_blank" rel="noopener noreferrer">
          Visit {{ designer.name }} online <span>↗</span>
        </a>
      </div>
    </section>

    <section class="designer-featured">
      <header>
        <p class="eyebrow">Selected work</p>
        <h2>Featured Products</h2>
        <p>Pieces that express {{ designer.name }}’s distinctive approach to proportion, material, and modern luxury.</p>
      </header>
      <div class="designer-featured__grid">
        <article v-for="(product, index) in designer.featuredProducts" :key="product.name">
          <div>
            <img :src="product.image" :alt="product.name" loading="lazy" />
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
          </div>
          <h3>{{ product.name }}</h3>
          <p>{{ product.description }}</p>
        </article>
      </div>
    </section>

    <nav class="designer-profile__back" aria-label="Designer navigation">
      <a href="/designers"><span>←</span> Meet all designers</a>
    </nav>
  </main>
</template>
