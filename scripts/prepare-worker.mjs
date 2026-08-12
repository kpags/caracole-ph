import { copyFile, mkdir, writeFile } from 'node:fs/promises'

await mkdir(new URL('../dist/server/', import.meta.url), { recursive: true })
await mkdir(new URL('../dist/.openai/', import.meta.url), { recursive: true })
await copyFile(
  new URL('../.openai/hosting.json', import.meta.url),
  new URL('../dist/.openai/hosting.json', import.meta.url),
)
await writeFile(
  new URL('../dist/server/index.js', import.meta.url),
  `export default {
  async fetch(request, env) {
    if (env.ASSETS) {
      const response = await env.ASSETS.fetch(request)
      if (response.status !== 404 || request.method !== 'GET') return response
      const url = new URL(request.url)
      return env.ASSETS.fetch(new Request(new URL('/', url), request))
    }
    return new Response('Caracole Philippines', {
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  },
}\n`,
)
