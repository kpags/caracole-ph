import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from '../src/config.js'
import { createCloudflareR2StorageFromConfig } from '../src/lib/cloudflare-r2-storage.js'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const logoDirectory = process.env.BRAND_LOGO_SOURCE_DIR || path.resolve(scriptDirectory, '../../assets/logos')
const cacheControl = 'public, max-age=300, must-revalidate'
const logos = [
  'caracole_black.png',
  'caracole_white.png',
  'caracole_charcoal.png',
  'caracole_butternut.png'
]

async function uploadBrandLogos() {
  const storage = createCloudflareR2StorageFromConfig(config)
  const uploadedUrls = []

  for (const fileName of logos) {
    const objectKey = `logos/${fileName}`
    const imageUrl = await storage.upload({
      body: await readFile(path.join(logoDirectory, fileName)),
      fileName,
      contentType: 'image/png',
      prefix: 'logos',
      objectKey,
      cacheControl
    })
    uploadedUrls.push(imageUrl)
  }

  for (const imageUrl of uploadedUrls) console.log(imageUrl)
}

uploadBrandLogos().catch((error) => {
  console.error(`Brand logo upload failed: ${error.message}`)
  process.exitCode = 1
})
