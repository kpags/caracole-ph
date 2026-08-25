import { cp, mkdir } from 'node:fs/promises'

// Nuxt's Cloudflare Pages preset emits the SSR worker inside _worker.js.
// The workspace host packages workers from dist/server/index.js, so mirror the
// complete worker directory without changing its relative imports.
await mkdir(new URL('../dist/server/', import.meta.url), { recursive: true })
await cp(
  new URL('../dist/_worker.js/', import.meta.url),
  new URL('../dist/server/', import.meta.url),
  { recursive: true, force: true },
)
