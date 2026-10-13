import { existsSync, promises as fs } from 'node:fs'
import { basename, extname, resolve } from 'node:path'

const API_VERSION = '2026-07'
const VENDOR = 'Caracole'
const ROOT = process.cwd()
const SOURCE_ROOT = resolve(ROOT, 'work', 'new_caracole_images')
const PREVIEW_PATH = resolve(ROOT, 'work', 'caracole-media-replacement-preview.json')
const STATE_PATH = resolve(ROOT, 'work', 'caracole-media-replacement-state.jsonl')
const READY_TIMEOUT_MS = 300_000
const POLL_INTERVAL_MS = 2_000
const MIME_TYPES = new Map([
  ['.avif', 'image/avif'],
  ['.gif', 'image/gif'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.tif', 'image/tiff'],
  ['.tiff', 'image/tiff'],
  ['.webp', 'image/webp'],
])

const PRODUCTS_QUERY = `#graphql
  query CaracoleProducts($after: String) {
    products(first: 250, after: $after, query: "vendor:Caracole") {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        title
        vendor
        variants(first: 250) { nodes { sku } }
        media(first: 250, sortKey: POSITION) {
          pageInfo { hasNextPage }
          nodes {
            id
            alt
            mediaContentType
            preview { status }
          }
        }
      }
    }
  }
`

const PRODUCT_MEDIA_QUERY = `#graphql
  query ProductMedia($id: ID!) {
    product(id: $id) {
      id
      title
      media(first: 250, sortKey: POSITION) {
        pageInfo { hasNextPage }
        nodes {
          id
          alt
          mediaContentType
          preview { status }
        }
      }
    }
  }
`

const STAGED_UPLOADS_MUTATION = `#graphql
  mutation StagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters { name value }
      }
      userErrors { field message }
    }
  }
`

const PRODUCT_UPDATE_MUTATION = `#graphql
  mutation ProductUpdate($product: ProductUpdateInput!, $media: [CreateMediaInput!]) {
    productUpdate(product: $product, media: $media) {
      product { id }
      userErrors { field message }
    }
  }
`

const REORDER_MEDIA_MUTATION = `#graphql
  mutation ProductReorderMedia($id: ID!, $moves: [MoveInput!]!) {
    productReorderMedia(id: $id, moves: $moves) {
      job { id }
      mediaUserErrors { field message }
    }
  }
`

const DELETE_MEDIA_MUTATION = `#graphql
  mutation ProductDeleteMedia($productId: ID!, $mediaIds: [ID!]!) {
    productDeleteMedia(productId: $productId, mediaIds: $mediaIds) {
      deletedMediaIds
      mediaUserErrors { field message }
    }
  }
`

function sleep(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds))
}

function userErrorMessage(errors) {
  return JSON.stringify(errors)
}

async function readEnv() {
  const contents = await fs.readFile(resolve(ROOT, '.env'), 'utf8')
  return Object.fromEntries(contents.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=')
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')]
    }))
}

function required(env, key) {
  const value = env[key]?.trim()
  if (!value) throw new Error(`Missing ${key} in .env`)
  return value
}

async function getAdminToken(env) {
  const response = await fetch(`https://${required(env, 'SHOPIFY_STORE_DOMAIN')}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: required(env, 'SHOPIFY_CLIENT_ID'),
      client_secret: required(env, 'SHOPIFY_CLIENT_SECRET'),
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload.access_token) throw new Error(payload.error_description || payload.error || `Token request failed (${response.status})`)
  return payload.access_token
}

async function requestAdmin(context, query, variables) {
  const response = await fetch(`https://${context.storeDomain}/admin/api/${context.apiVersion}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': context.token },
    body: JSON.stringify({ query, variables }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.errors) throw new Error(payload.errors?.map((error) => error.message).join('; ') || `Admin API request failed (${response.status})`)
  return payload.data
}

function compareNatural(left, right) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
}

async function buildManifest() {
  const batches = (await fs.readdir(SOURCE_ROOT, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => compareNatural(left.name, right.name))
  const products = []
  for (const batch of batches) {
    const batchPath = resolve(SOURCE_ROOT, batch.name)
    const skuFolders = (await fs.readdir(batchPath, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .sort((left, right) => compareNatural(left.name, right.name))
    if (skuFolders.length !== 2) throw new Error(`${batch.name} must contain exactly two SKU folders; found ${skuFolders.length}`)
    for (const folder of skuFolders) {
      const separator = folder.name.lastIndexOf('_')
      if (separator <= 0) throw new Error(`Cannot derive SKU from ${folder.name}`)
      const sku = folder.name.slice(0, separator)
      const directory = resolve(batchPath, folder.name)
      const files = (await fs.readdir(directory, { withFileTypes: true }))
        .filter((entry) => entry.isFile() && MIME_TYPES.has(extname(entry.name).toLowerCase()))
        .map((entry) => ({ name: entry.name, path: resolve(directory, entry.name), mimeType: MIME_TYPES.get(extname(entry.name).toLowerCase()) }))
      const main = files.filter((file) => /main_image/i.test(file.name))
      if (main.length !== 1) throw new Error(`${folder.name} must contain exactly one main_image file; found ${main.length}`)
      const lifestyle = files.filter((file) => file !== main[0]).sort((left, right) => compareNatural(left.name, right.name))
      if (lifestyle.length !== 3) throw new Error(`${folder.name} must contain exactly three lifestyle images; found ${lifestyle.length}`)
      products.push({ sku, folder: folder.name, main: main[0], lifestyle, files: [main[0], ...lifestyle] })
    }
  }
  if (products.length !== 342) throw new Error(`Expected 342 SKU folders; found ${products.length}`)
  if (new Set(products.map((product) => product.sku)).size !== products.length) throw new Error('Duplicate local SKU folders found')
  return products.sort((left, right) => compareNatural(left.sku, right.sku))
}

async function loadProducts(context) {
  const products = []
  let after = null
  do {
    const data = await requestAdmin(context, PRODUCTS_QUERY, { after })
    const connection = data.products
    for (const product of connection.nodes) {
      if (product.vendor !== VENDOR) throw new Error(`Unexpected vendor returned for ${product.id}: ${product.vendor}`)
      if (product.media.pageInfo.hasNextPage) throw new Error(`Product has more than 250 media records: ${product.id}`)
      products.push(product)
    }
    after = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null
  } while (after)
  return products
}

function resolveProducts(manifest, products) {
  const productsBySku = new Map()
  for (const product of products) {
    for (const variant of product.variants.nodes) {
      const sku = variant.sku?.trim()
      if (!sku) continue
      const matches = productsBySku.get(sku) || []
      matches.push(product)
      productsBySku.set(sku, matches)
    }
  }
  return manifest.map((entry) => {
    const distinct = [...new Map((productsBySku.get(entry.sku) || []).map((product) => [product.id, product])).values()]
    if (distinct.length !== 1) throw new Error(`Expected one Caracole product for SKU ${entry.sku}; found ${distinct.length}`)
    return { ...entry, product: distinct[0] }
  })
}

async function readState() {
  if (!existsSync(STATE_PATH)) return new Map()
  const entries = new Map()
  for (const line of (await fs.readFile(STATE_PATH, 'utf8')).split(/\r?\n/).filter(Boolean)) {
    const entry = JSON.parse(line)
    entries.set(entry.sku, entry)
  }
  return entries
}

async function checkpoint(entry) {
  await fs.appendFile(STATE_PATH, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`, 'utf8')
}

async function stagedTargets(context, files) {
  const data = await requestAdmin(context, STAGED_UPLOADS_MUTATION, {
    input: files.map((file) => ({ filename: file.name, mimeType: file.mimeType, httpMethod: 'POST', resource: 'IMAGE' })),
  })
  const payload = data.stagedUploadsCreate
  if (payload.userErrors.length) throw new Error(`stagedUploadsCreate userErrors: ${userErrorMessage(payload.userErrors)}`)
  if (payload.stagedTargets.length !== files.length) throw new Error(`Expected ${files.length} staged targets; received ${payload.stagedTargets.length}`)
  return payload.stagedTargets
}

async function uploadFile(file, target) {
  const form = new FormData()
  for (const parameter of target.parameters) form.append(parameter.name, parameter.value)
  const contents = await fs.readFile(file.path)
  form.append('file', new Blob([contents], { type: file.mimeType }), file.name)
  const response = await fetch(target.url, { method: 'POST', body: form })
  if (!response.ok) throw new Error(`Staged upload failed for ${file.path}: ${response.status} ${await response.text()}`)
}

async function fetchMedia(context, productId) {
  const data = await requestAdmin(context, PRODUCT_MEDIA_QUERY, { id: productId })
  const product = data.product
  if (!product) throw new Error(`Product disappeared: ${productId}`)
  if (product.media.pageInfo.hasNextPage) throw new Error(`Product has more than 250 media records: ${productId}`)
  return product.media.nodes
}

function newMediaFromSnapshot(media, oldImageIds, expectedAlts) {
  return media.filter((item) => item.mediaContentType === 'IMAGE' && !oldImageIds.includes(item.id) && expectedAlts.includes(item.alt))
}

async function waitForReadyMedia(context, productId, oldImageIds, expectedAlts) {
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    const media = await fetchMedia(context, productId)
    const created = newMediaFromSnapshot(media, oldImageIds, expectedAlts)
    if (created.length > expectedAlts.length) throw new Error(`Found duplicate uploaded media for ${productId}`)
    if (created.length === expectedAlts.length && created.every((item) => item.preview?.status === 'READY')) return { media, created }
    await sleep(POLL_INTERVAL_MS)
  }
  throw new Error(`Timed out waiting for uploaded media on ${productId}`)
}

async function attachMedia(context, productId, files, targets) {
  const data = await requestAdmin(context, PRODUCT_UPDATE_MUTATION, {
    product: { id: productId },
    media: files.map((file, index) => ({ mediaContentType: 'IMAGE', originalSource: targets[index].resourceUrl, alt: file.name })),
  })
  if (data.productUpdate.userErrors.length) throw new Error(`productUpdate userErrors: ${userErrorMessage(data.productUpdate.userErrors)}`)
}

async function reorderMedia(context, productId, orderedIds) {
  const data = await requestAdmin(context, REORDER_MEDIA_MUTATION, {
    id: productId,
    moves: orderedIds.map((id, index) => ({ id, newPosition: String(index) })),
  })
  if (data.productReorderMedia.mediaUserErrors.length) throw new Error(`productReorderMedia userErrors: ${userErrorMessage(data.productReorderMedia.mediaUserErrors)}`)
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    const media = await fetchMedia(context, productId)
    if (media.slice(0, orderedIds.length).map((item) => item.id).every((id, index) => id === orderedIds[index])) return
    await sleep(POLL_INTERVAL_MS)
  }
  throw new Error(`Timed out waiting for media reorder on ${productId}`)
}

async function deleteMedia(context, productId, mediaIds) {
  if (!mediaIds.length) return
  const data = await requestAdmin(context, DELETE_MEDIA_MUTATION, { productId, mediaIds })
  if (data.productDeleteMedia.mediaUserErrors.length) throw new Error(`productDeleteMedia userErrors: ${userErrorMessage(data.productDeleteMedia.mediaUserErrors)}`)
  if (data.productDeleteMedia.deletedMediaIds.length !== mediaIds.length) throw new Error(`Expected ${mediaIds.length} deleted media IDs for ${productId}; received ${data.productDeleteMedia.deletedMediaIds.length}`)
}

async function applyProduct(context, entry, state) {
  const expectedAlts = entry.files.map((file) => file.name)
  const productId = entry.product.id
  const prior = state.get(entry.sku)
  if (prior?.status === 'completed') return { status: 'skipped' }

  let oldImageIds = prior?.oldImageIds
  let media = await fetchMedia(context, productId)
  if (!oldImageIds) {
    oldImageIds = media.filter((item) => item.mediaContentType === 'IMAGE').map((item) => item.id)
    await checkpoint({ sku: entry.sku, productId, status: 'prepared', oldImageIds, filenames: expectedAlts })
  }

  let created = newMediaFromSnapshot(media, oldImageIds, expectedAlts)
  if (created.length && created.length !== expectedAlts.length) throw new Error(`Found partial prior upload for SKU ${entry.sku}; refusing to duplicate media`)
  if (!created.length) {
    const targets = await stagedTargets(context, entry.files)
    await Promise.all(entry.files.map((file, index) => uploadFile(file, targets[index])))
    await attachMedia(context, productId, entry.files, targets)
    const result = await waitForReadyMedia(context, productId, oldImageIds, expectedAlts)
    media = result.media
    created = result.created
    await checkpoint({ sku: entry.sku, productId, status: 'attached', oldImageIds, newImageIds: created.map((item) => item.id), filenames: expectedAlts })
  } else {
    const result = await waitForReadyMedia(context, productId, oldImageIds, expectedAlts)
    media = result.media
    created = result.created
  }

  const createdByAlt = new Map(created.map((item) => [item.alt, item.id]))
  const orderedIds = expectedAlts.map((alt) => createdByAlt.get(alt))
  if (orderedIds.some((id) => !id)) throw new Error(`Could not map all uploaded media IDs for SKU ${entry.sku}`)
  await reorderMedia(context, productId, orderedIds)
  await checkpoint({ sku: entry.sku, productId, status: 'reordered', oldImageIds, newImageIds: orderedIds, filenames: expectedAlts })

  media = await fetchMedia(context, productId)
  const presentOldIds = oldImageIds.filter((id) => media.some((item) => item.id === id))
  await deleteMedia(context, productId, presentOldIds)
  await checkpoint({ sku: entry.sku, productId, status: 'completed', oldImageIds, newImageIds: orderedIds, filenames: expectedAlts })
  return { status: 'completed', deleted: presentOldIds.length }
}

async function verify(context, entries) {
  let imageTotal = 0
  for (const entry of entries) {
    const media = await fetchMedia(context, entry.product.id)
    const images = media.filter((item) => item.mediaContentType === 'IMAGE')
    const expectedAlts = entry.files.map((file) => file.name)
    if (images.length !== 4) throw new Error(`Expected four image media records for SKU ${entry.sku}; found ${images.length}`)
    if (!images.every((item, index) => item.alt === expectedAlts[index] && item.preview?.status === 'READY')) throw new Error(`Final media order or status is invalid for SKU ${entry.sku}`)
    imageTotal += images.length
  }
  if (imageTotal !== 1368) throw new Error(`Expected 1,368 final image media records; found ${imageTotal}`)
}

async function main() {
  const apply = process.argv.includes('--apply')
  const manifest = await buildManifest()
  const env = await readEnv()
  const context = {
    storeDomain: required(env, 'SHOPIFY_STORE_DOMAIN'),
    apiVersion: env.SHOPIFY_STOREFRONT_API_VERSION || API_VERSION,
    token: await getAdminToken(env),
  }
  const products = await loadProducts(context)
  const entries = resolveProducts(manifest, products)
  const existingImageMedia = products.reduce((count, product) => count + product.media.nodes.filter((item) => item.mediaContentType === 'IMAGE').length, 0)
  const preview = { generatedAt: new Date().toISOString(), vendor: VENDOR, products: entries.length, mainImages: entries.length, lifestyleImages: entries.length * 3, inputImages: entries.length * 4, existingImageMedia, entries: entries.map((entry) => ({ sku: entry.sku, productId: entry.product.id, title: entry.product.title, files: entry.files.map((file) => file.name) })) }
  await fs.writeFile(PREVIEW_PATH, `${JSON.stringify(preview, null, 2)}\n`, 'utf8')
  process.stdout.write(`Preview written: ${PREVIEW_PATH}\n`)
  process.stdout.write(`Resolved ${entries.length} Caracole products, ${preview.inputImages} replacement images, and ${existingImageMedia} existing image-media records\n`)
  if (!apply) return

  const state = await readState()
  let completed = 0
  let skipped = 0
  let deleted = 0
  for (const entry of entries) {
    const result = await applyProduct(context, entry, state)
    if (result.status === 'skipped') skipped += 1
    else {
      completed += 1
      deleted += result.deleted
    }
    process.stdout.write(`Progress: ${completed + skipped}/${entries.length} products\n`)
  }
  await verify(context, entries)
  process.stdout.write(JSON.stringify({ completed, resumed: skipped, deletedOldImageMedia: deleted, finalImageMedia: 1368 }, null, 2) + '\n')
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`)
  process.exitCode = 1
})
