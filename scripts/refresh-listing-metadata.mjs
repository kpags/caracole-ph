import { readFile, writeFile } from 'node:fs/promises'

const productPath = new URL('../src/data/products.json', import.meta.url)
const products = JSON.parse(await readFile(productPath, 'utf8'))
const results = []
let nextUrl = 'https://api.caracole.ph/api/products/products/?is_archived=false&page_size=100'
while (nextUrl) {
  const response = await fetch(nextUrl)
  if (!response.ok) throw new Error(`Product metadata request failed: ${response.status}`)
  const payload = await response.json()
  if (Array.isArray(payload.results)) results.push(...payload.results)
  nextUrl = payload.next || null
}
const byEdp = new Map(results.map((product) => [String(product.edp_number), product]))

const enriched = products.map((product) => {
  const source = byEdp.get(String(product.edpNumber))
  return {
    ...product,
    stockQuantity: Number.isFinite(Number(source?.quantity)) ? Number(source.quantity) : (product.isActive === false ? 0 : 1),
    origin: product.origin || 'Not specified',
  }
})

await writeFile(productPath, `${JSON.stringify(enriched, null, 2)}\n`)
console.log(`Updated listing metadata for ${enriched.length} products; matched ${enriched.filter((product) => byEdp.has(String(product.edpNumber))).length}.`)
