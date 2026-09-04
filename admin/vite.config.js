import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    // Admin compiles shared components from ../src; resolve their UI imports
    // from the Admin app's own dependencies in both local and Docker builds.
    alias: {
      primevue: fileURLToPath(new URL('./node_modules/primevue', import.meta.url)),
      primeicons: fileURLToPath(new URL('./node_modules/primeicons', import.meta.url)),
      quill: fileURLToPath(new URL('./node_modules/quill', import.meta.url))
    }
  },
  publicDir: '../public',
  server: {
    fs: {
      allow: ['..'],
    },
  },
})
