import archiver from 'archiver'
import { createWriteStream, existsSync, promises as fs } from 'node:fs'
import { basename, extname, resolve } from 'node:path'

const OUTPUT_NAME = 'caracole_main_images.zip'
const PARTIAL_OUTPUT_NAME = `${OUTPUT_NAME}.partial`
const BACKUP_OUTPUT_NAME = `${OUTPUT_NAME}.previous`
const DOWNLOAD_CONCURRENCY = 32
const DOWNLOAD_TIMEOUT_MS = 30_000
const DOWNLOAD_ATTEMPTS = 3
const API_VERSION = '2026-07'
const VENDOR = 'Caracole'
const CONTENT_TYPE_EXTENSIONS = new Map([
  ['image/avif', '.avif'],
  ['image/gif', '.gif'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/tiff', '.tiff'],
  ['image/webp', '.webp'],
])
const SAFE_EXTENSIONS = new Set(CONTENT_TYPE_EXTENSIONS.values())

function readEnvFile(path) {
  return fs.readFile(path, 'utf8').then((contents) => Object.fromEntries(
    contents.split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=')
        const key = line.slice(0, separator).trim()
        const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')
        return [key, value]
      })
  ))
}

function required(env, key) {
  const value = env[key]?.trim()
  if (!value) throw new Error(`Missing ${key} in .env`)
  return value
}

async function getAdminToken({ storeDomain, clientId, clientSecret }) {
  const response = await fetch(`https://${storeDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || `Shopify token request failed (${response.status})`)
  }
  return payload.access_token
}

async function requestAdmin({ storeDomain, apiVersion, token, query, variables }) {
  const response = await fetch(`https://${storeDomain}/admin/api/${apiVersion}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.errors) {
    throw new Error(payload.errors?.map((entry) => entry.message).join('; ') || `Shopify Admin API request failed (${response.status})`)
  }
  return payload.data
}

const PRODUCTS_QUERY = `#graphql
  query CaracoleProducts($after: String) {
    products(first: 250, after: $after, query: "vendor:Caracole", sortKey: ID) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        title
        vendor
        featuredImage { url }
        metafield(namespace: "custom", key: "categories") { value }
        variants(first: 1) { nodes { sku } }
      }
    }
  }
`

async function getProducts(options) {
  const products = []
  let after = null
  do {
    const data = await requestAdmin({ ...options, query: PRODUCTS_QUERY, variables: { after } })
    const connection = data?.products
    if (!connection) throw new Error('Shopify returned an invalid products response')
    products.push(...connection.nodes)
    after = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null
  } while (after)
  return products
}

function extensionFor(response, imageUrl) {
  const contentType = response.headers.get('content-type')?.split(';', 1)[0].toLowerCase()
  if (CONTENT_TYPE_EXTENSIONS.has(contentType)) return CONTENT_TYPE_EXTENSIONS.get(contentType)

  try {
    const urlExtension = extname(new URL(imageUrl).pathname).toLowerCase()
    if (SAFE_EXTENSIONS.has(urlExtension)) return urlExtension
  } catch {
    // The URL was already fetched successfully; fail below with a useful message.
  }
  throw new Error(`Unsupported image content type: ${contentType || 'not provided'}`)
}

function validateProducts(products) {
  if (!products.length) throw new Error(`No products found for vendor ${VENDOR}`)
  const paths = new Set()
  return products.map((product) => {
    const sku = product.variants.nodes[0]?.sku?.trim()
    const imageUrl = product.featuredImage?.url
    const category = product.metafield?.value?.split('>', 1)[0].trim()
    if (!sku) throw new Error(`Missing first-variant SKU for ${product.title} (${product.id})`)
    if (!imageUrl) throw new Error(`Missing featured image for ${product.title} (${sku})`)
    if (!category) throw new Error(`Missing top-level category for ${product.title} (${sku})`)
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(sku)) throw new Error(`Unsafe SKU for archive path: ${sku}`)
    if (!/^[A-Za-z0-9][A-Za-z0-9 _.-]*$/.test(category)) throw new Error(`Unsafe category for archive path: ${category}`)
    const folderName = `${sku}_${category}`
    const pathPrefix = `${folderName}/${sku}_main_image`
    if (paths.has(pathPrefix)) throw new Error(`Duplicate archive path for SKU ${sku}`)
    paths.add(pathPrefix)
    return { title: product.title, sku, category, imageUrl, pathPrefix }
  })
}

async function downloadImage(product) {
  let lastError = null
  for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(product.imageUrl, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) })
      if (!response.ok) throw new Error(`Image download failed (${response.status}) for ${product.sku}: ${product.imageUrl}`)
      const extension = extensionFor(response, product.imageUrl)
      const contents = Buffer.from(await response.arrayBuffer())
      if (!contents.length) throw new Error(`Image download was empty for ${product.sku}`)
      return { ...product, contents, archivePath: `${product.pathPrefix}${extension}` }
    } catch (error) {
      lastError = error
    }
  }
  throw new Error(`Image download failed after ${DOWNLOAD_ATTEMPTS} attempts for ${product.sku}: ${lastError.message}`)
}

async function appendDownloads(archive, products) {
  for (let index = 0; index < products.length; index += DOWNLOAD_CONCURRENCY) {
    const batch = await Promise.all(products.slice(index, index + DOWNLOAD_CONCURRENCY).map(downloadImage))
    for (const image of batch) archive.append(image.contents, { name: image.archivePath })
    process.stdout.write(`Downloaded ${Math.min(index + batch.length, products.length)}/${products.length} images\n`)
  }
}

async function createArchive(products, outputPath, partialPath, backupPath) {
  const output = createWriteStream(partialPath, { flags: 'wx' })
  const archive = archiver('zip', { zlib: { level: 9 } })
  const completion = new Promise((resolvePromise, rejectPromise) => {
    output.once('close', resolvePromise)
    output.once('error', rejectPromise)
    archive.once('error', rejectPromise)
  })
  archive.pipe(output)
  await appendDownloads(archive, products)
  await archive.finalize()
  await completion
  const hasExistingArchive = existsSync(outputPath)
  if (hasExistingArchive) await fs.rename(outputPath, backupPath)
  try {
    await fs.rename(partialPath, outputPath)
    if (hasExistingArchive) await fs.unlink(backupPath)
  } catch (error) {
    if (hasExistingArchive && existsSync(backupPath) && !existsSync(outputPath)) await fs.rename(backupPath, outputPath)
    throw error
  }
}

async function main() {
  const root = process.cwd()
  const outputPath = resolve(root, OUTPUT_NAME)
  const partialPath = resolve(root, PARTIAL_OUTPUT_NAME)
  const backupPath = resolve(root, BACKUP_OUTPUT_NAME)
  const replaceOutput = process.argv.includes('--replace')
  if (existsSync(outputPath) && !replaceOutput) throw new Error(`${basename(outputPath)} already exists; rerun with --replace to overwrite it`)
  if (existsSync(partialPath)) throw new Error(`${basename(partialPath)} already exists; remove it after reviewing the prior failed run`)
  if (existsSync(backupPath)) throw new Error(`${basename(backupPath)} already exists; review it before starting another replacement`)

  const env = await readEnvFile(resolve(root, '.env'))
  const storeDomain = required(env, 'SHOPIFY_STORE_DOMAIN')
  const token = await getAdminToken({
    storeDomain,
    clientId: required(env, 'SHOPIFY_CLIENT_ID'),
    clientSecret: required(env, 'SHOPIFY_CLIENT_SECRET'),
  })
  const products = validateProducts(await getProducts({ storeDomain, apiVersion: env.SHOPIFY_STOREFRONT_API_VERSION || API_VERSION, token }))
  process.stdout.write(`Validated ${products.length} ${VENDOR} products with unique EDP/SKU values and featured images\n`)
  await createArchive(products, outputPath, partialPath, backupPath)

  const stats = await fs.stat(outputPath)
  process.stdout.write(JSON.stringify({ outputPath, products: products.length, files: products.length, bytes: stats.size }, null, 2) + '\n')
}

main().catch((error) => {
  process.stderr.write(`Export failed: ${error.message}\n`)
  process.exitCode = 1
})
