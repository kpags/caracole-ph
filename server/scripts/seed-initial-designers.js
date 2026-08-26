import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from '../src/config.js'
import { createCloudflareR2StorageFromConfig } from '../src/lib/cloudflare-r2-storage.js'
import { prisma } from '../src/lib/prisma.js'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const seedDirectory = process.env.DESIGNER_SEED_DIR || path.resolve(scriptDirectory, '../../assets/designers')
const initialDetailsPath = path.join(seedDirectory, 'details.json')
const supportedMimeTypes = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp']
])

function contentTypeFor(filePath) {
  const contentType = supportedMimeTypes.get(path.extname(filePath).toLowerCase())
  if (!contentType) throw new Error(`Unsupported initial designer image type: ${filePath}`)
  return contentType
}

function resolveAssetPath(sourcePath) {
  const relativePath = String(sourcePath).replaceAll('\\', '/').replace(/^assets\/designers\//, '')
  if (!relativePath || relativePath.startsWith('../') || path.isAbsolute(relativePath)) {
    throw new Error(`Invalid initial designer image path: ${sourcePath}`)
  }
  return path.join(seedDirectory, relativePath)
}

function limitedText(value, maximumLength) {
  return String(value || '').trim().slice(0, maximumLength)
}

async function uploadInitialImage(storage, sourcePath) {
  const assetPath = resolveAssetPath(sourcePath)
  const body = await readFile(assetPath)
  return storage.upload({
    body,
    fileName: path.basename(assetPath),
    contentType: contentTypeFor(assetPath),
    prefix: 'designers'
  })
}

async function seedInitialDesigners() {
  const source = JSON.parse(await readFile(initialDetailsPath, 'utf8'))
  const storage = createCloudflareR2StorageFromConfig(config)
  let created = 0
  let featuredCount = await prisma.designerProfile.count({ where: { isFeatured: true } })

  for (const [slug, designer] of Object.entries(source)) {
    const existing = await prisma.designerProfile.findUnique({ where: { slug }, select: { id: true } })
    if (existing) continue

    const uploadedUrls = []
    try {
      const thumbnailImageUrl = await uploadInitialImage(storage, designer.image)
      uploadedUrls.push(thumbnailImageUrl)
      const headerImageUrl = await uploadInitialImage(storage, designer.banner)
      uploadedUrls.push(headerImageUrl)
      const featuredProducts = []
      for (const [position, product] of (designer.featured_products || []).slice(0, 5).entries()) {
        const lifestyleImageUrl = await uploadInitialImage(storage, product.image)
        uploadedUrls.push(lifestyleImageUrl)
        featuredProducts.push({
          name: limitedText(product.name, 160),
          shortDescription: limitedText(product.description, 150),
          lifestyleImageUrl,
          position
        })
      }

      await prisma.designerProfile.create({
        data: {
          slug,
          name: limitedText(designer.name, 160),
          link: String(designer.link || '').trim() || null,
          tagline: limitedText(designer.intro_description, 100),
          briefStory: limitedText(designer.profile_description, 300),
          isFeatured: featuredCount < 2,
          thumbnailImageUrl,
          headerImageUrl,
          featuredProducts: { create: featuredProducts }
        }
      })
      created += 1
      if (featuredCount < 2) featuredCount += 1
    } catch (error) {
      await Promise.all(uploadedUrls.map((url) => storage.delete(url).catch(() => {})))
      throw error
    }
  }

  console.log(`Initial designer seed completed: ${created} profile(s) created.`)
}

try {
  await seedInitialDesigners()
} finally {
  await prisma.$disconnect()
}
