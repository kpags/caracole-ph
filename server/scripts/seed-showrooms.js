import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { config } from '../src/config.js'
import { createCloudflareR2StorageFromConfig } from '../src/lib/cloudflare-r2-storage.js'
import { prisma } from '../src/lib/prisma.js'

const seedDirectory = process.env.SHOWROOM_SEED_DIR || path.resolve('public/media/locations')
const mimeTypes = new Map([['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.png', 'image/png'], ['.webp', 'image/webp']])
const initialBranches = [
  {
    name: 'GH Mall, San Juan', slug: 'gh-mall-san-juan', position: 0,
    address: '4F GH Mall, Ortigas Avenue, San Juan City, Philippines',
    contactNumbers: ['(02) 8682-0074', '0917-183-1793'],
    schedules: [{ dayStart: 0, dayEnd: 3, timeOpen: '10:00', timeClose: '21:00' }, { dayStart: 4, dayEnd: 6, timeOpen: '10:00', timeClose: '22:00' }],
    images: ['greenhills/image_1.jpg', 'greenhills/image_2.jpg', 'greenhills/image_3.jpg']
  },
  {
    name: 'Manresa, Quezon City', slug: 'manresa-quezon-city', position: 1,
    address: '157 Sgt. E. Rivera Street, Brgy. Manresa, Quezon City, Philippines',
    contactNumbers: ['(02) 8362-1111', '0917-858-3858'],
    schedules: [{ dayStart: 0, dayEnd: 4, timeOpen: '08:30', timeClose: '17:30' }],
    images: ['quezon-city/image_1.jpeg', 'quezon-city/image_2.jpeg', 'quezon-city/image_3.jpeg']
  }
]

async function seedShowrooms() {
  const storage = createCloudflareR2StorageFromConfig(config)
  let created = 0
  for (const branch of initialBranches) {
    if (await prisma.showroomBranch.findUnique({ where: { slug: branch.slug }, select: { id: true } })) continue
    const uploaded = []
    try {
      for (const relativeImagePath of branch.images) {
        const assetPath = path.join(seedDirectory, relativeImagePath)
        const imageUrl = await storage.upload({
          body: await readFile(assetPath), fileName: path.basename(assetPath),
          contentType: mimeTypes.get(path.extname(assetPath).toLowerCase()), prefix: `showrooms/${branch.slug}`
        })
        uploaded.push(imageUrl)
      }
      await prisma.showroomBranch.create({
        data: {
          name: branch.name, slug: branch.slug, address: branch.address, contactNumbers: branch.contactNumbers, position: branch.position,
          images: { create: uploaded.map((imageUrl, position) => ({ imageUrl, position })) },
          schedules: { create: branch.schedules.map((schedule, position) => ({ ...schedule, position })) }
        }
      })
      created += 1
    } catch (error) {
      await Promise.all(uploaded.map((url) => storage.delete(url).catch(() => {})))
      throw error
    }
  }
  console.log(`Initial showroom seed completed: ${created} branch(es) created.`)
}

try {
  await seedShowrooms()
} finally {
  await prisma.$disconnect()
}
