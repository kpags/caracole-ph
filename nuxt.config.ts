export default defineNuxtConfig({
  compatibilityDate: '2026-08-25',
  ssr: true,
  devtools: { enabled: false },
  css: ['../src/styles.css'],
  runtimeConfig: {
    public: {
      // Set NUXT_PUBLIC_API_BASE_URL at runtime. VITE_API_URL remains accepted
      // during the transition so existing local environments keep working.
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || process.env.VITE_API_URL || 'http://localhost:3000',
    },
  },
  nitro: {
    // The existing Express service lives in /server; Nuxt must not treat it as
    // its own server source tree.
    serverDir: 'nuxt-server',
  },
})
