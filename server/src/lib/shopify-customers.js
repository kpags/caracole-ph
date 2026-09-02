import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { createShopifyAdminTokenProvider } from './shopify-admin-token.js'
import { HttpError } from './http.js'

const storefrontCustomerFields = `id firstName lastName email phone`
const CUSTOMER_QUERY = `#graphql
  query Customers($after: String) {
    customers(first: 100, after: $after, sortKey: UPDATED_AT) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id firstName lastName createdAt updatedAt numberOfOrders state verifiedEmail tags
        defaultEmailAddress { emailAddress }
        defaultPhoneNumber { phoneNumber }
        amountSpent { amount currencyCode }
        defaultAddress { id firstName lastName company address1 address2 city province provinceCode country countryCodeV2 zip phone name }
      }
    }
  }
`

function customerError(errors, fallback) {
  const message = errors?.map((error) => error.message).filter(Boolean).join('; ') || fallback
  return new HttpError(400, message)
}

async function storefrontRequest(config, query, variables) {
  const response = await fetch(`https://${config.SHOPIFY_STORE_DOMAIN}/api/${config.SHOPIFY_STOREFRONT_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Shopify-Storefront-Private-Token': config.SHOPIFY_PRIVATE_ACCESS_TOKEN },
    body: JSON.stringify({ query, variables })
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.errors) throw customerError(payload.errors, `Shopify customer request failed (${response.status})`)
  return payload.data
}

async function adminRequest(config, tokenProvider, query, variables) {
  const token = await tokenProvider.getAccessToken()
  const response = await fetch(`https://${config.SHOPIFY_STORE_DOMAIN}/admin/api/${config.SHOPIFY_STOREFRONT_API_VERSION}/graphql.json`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token }, body: JSON.stringify({ query, variables })
  })
  const text = await response.text()
  let payload = {}
  try { payload = text ? JSON.parse(text) : {} } catch { /* permission gateways may return non-JSON. */ }
  if (!response.ok || payload.errors) {
    const detail = payload.errors?.map((error) => error.message).join('; ') || text || `HTTP ${response.status}`
    throw new Error(`Shopify customer sync is unavailable. Enable Admin customer read access and protected customer data approval. ${detail}`)
  }
  return payload.data
}

export function createUnusablePassword() {
  return crypto.randomBytes(32).toString('base64url')
}

export function createShopifyCustomerService(config) {
  return {
    async create({ firstName, lastName, email, password }) {
      const data = await storefrontRequest(config, `mutation CustomerCreate($input: CustomerCreateInput!) {
        customerCreate(input: $input) { customer { ${storefrontCustomerFields} } customerUserErrors { field message code } }
      }`, { input: { firstName, lastName, email, password } })
      const result = data.customerCreate
      if (result.customerUserErrors?.length) throw customerError(result.customerUserErrors, 'Unable to create Shopify customer')
      if (!result.customer) throw new HttpError(502, 'Shopify did not create the customer account')
      return result.customer
    },
    async authenticate({ email, password }) {
      const login = await storefrontRequest(config, `mutation CustomerAccessTokenCreate($input: CustomerAccessTokenCreateInput!) {
        customerAccessTokenCreate(input: $input) { customerAccessToken { accessToken } customerUserErrors { field message code } }
      }`, { input: { email, password } })
      const result = login.customerAccessTokenCreate
      if (result.customerUserErrors?.length || !result.customerAccessToken) throw new HttpError(401, 'Invalid email or password')
      const data = await storefrontRequest(config, `query Customer($token: String!) { customer(customerAccessToken: $token) { ${storefrontCustomerFields} } }`, { token: result.customerAccessToken.accessToken })
      if (!data.customer) throw new HttpError(401, 'Invalid email or password')
      return data.customer
    },
    async recover(email) {
      const data = await storefrontRequest(config, `mutation CustomerRecover($email: String!) { customerRecover(email: $email) { customerUserErrors { field message code } } }`, { email })
      if (data.customerRecover.customerUserErrors?.length) throw customerError(data.customerRecover.customerUserErrors, 'Unable to start password recovery')
    }
  }
}

function normalizedEmail(customer) { return customer.defaultEmailAddress?.emailAddress?.trim().toLowerCase() || null }
function customerData(customer, now) {
  return {
    shopifyId: customer.id,
    phone: customer.defaultPhoneNumber?.phoneNumber || customer.defaultAddress?.phone || null,
    shopifyState: customer.state || null,
    shopifyVerifiedEmail: customer.verifiedEmail ?? null,
    orderCount: customer.numberOfOrders || 0,
    amountSpent: customer.amountSpent?.amount ?? null,
    currencyCode: customer.amountSpent?.currencyCode || null,
    tags: customer.tags || [],
    defaultAddress: customer.defaultAddress || null,
    shopifyCreatedAt: customer.createdAt ? new Date(customer.createdAt) : null,
    shopifyUpdatedAt: customer.updatedAt ? new Date(customer.updatedAt) : null,
    lastSyncedAt: now
  }
}

export async function syncShopifyCustomers({ prisma, config, tokenProvider = createShopifyAdminTokenProvider(config), now = new Date(), logger = console }) {
  const seen = new Set()
  const counts = { fetchedCount: 0, createdCount: 0, updatedCount: 0, conflictCount: 0, removedCount: 0 }
  let after = null
  do {
    const data = await adminRequest(config, tokenProvider, CUSTOMER_QUERY, { after })
    const connection = data?.customers
    if (!connection) throw new Error('Shopify returned an invalid customer response')
    for (const remote of connection.nodes) {
      const email = normalizedEmail(remote)
      if (!email) continue
      seen.add(remote.id); counts.fetchedCount += 1
      const byShopify = await prisma.customer.findUnique({ where: { shopifyId: remote.id }, include: { user: true } })
      const user = byShopify?.user || await prisma.user.findUnique({ where: { email }, include: { customer: true } })
      if (user && (user.isDesigner || user.isStaff || user.isSuperuser)) { counts.conflictCount += 1; continue }
      const data = customerData(remote, now)
      if (user) {
        await prisma.user.update({ where: { id: user.id }, data: { firstName: remote.firstName || user.firstName, lastName: remote.lastName || user.lastName, customer: { upsert: { create: { ...data, source: 'SHOPIFY' }, update: data } } } })
        counts.updatedCount += 1
      } else {
        const password = await bcrypt.hash(createUnusablePassword(), config.BCRYPT_SALT_ROUNDS)
        await prisma.user.create({ data: { email, firstName: remote.firstName || null, lastName: remote.lastName || null, password, isActive: false, isEmailVerified: false, customer: { create: { ...data, source: 'SHOPIFY' } } } })
        counts.createdCount += 1
      }
    }
    after = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null
  } while (after)
  const stale = await prisma.customer.deleteMany({ where: { shopifyId: { not: null, notIn: [...seen] } } })
  counts.removedCount = stale.count
  logger.log(`Shopify customer sync: fetched=${counts.fetchedCount} created=${counts.createdCount} updated=${counts.updatedCount} conflicts=${counts.conflictCount} removed=${counts.removedCount}`)
  return counts
}

export async function migrateLocalCustomersToShopify({ prisma, config, tokenProvider = createShopifyAdminTokenProvider(config), logger = console }) {
  const users = await prisma.user.findMany({
    where: { isActive: true, isEmailVerified: true, isDesigner: false, isStaff: false, isSuperuser: false, OR: [{ customer: { is: null } }, { customer: { is: { shopifyId: null } } }] },
    select: { id: true, email: true, firstName: true, lastName: true, customer: { select: { id: true, shopifyId: true, legacyInvitationSentAt: true } } }
  })
  let migratedCount = 0
  for (const user of users) {
    let shopifyId = user.customer?.shopifyId
    if (!shopifyId) {
      const existing = await adminRequest(config, tokenProvider, `query FindCustomer($query: String!) { customers(first: 1, query: $query) { nodes { id } } }`, { query: `email:${user.email}` })
      shopifyId = existing.customers.nodes[0]?.id || null
    }
    if (!shopifyId) {
      const created = await adminRequest(config, tokenProvider, `mutation CreateCustomer($input: CustomerInput!) {
        customerCreate(input: $input) { customer { id } userErrors { field message } }
      }`, { input: { email: user.email, firstName: user.firstName || undefined, lastName: user.lastName || undefined } })
      const result = created.customerCreate
      if (result.userErrors?.length || !result.customer) throw new Error(result.userErrors?.map((error) => error.message).join('; ') || `Unable to create Shopify customer for ${user.email}`)
      shopifyId = result.customer.id
    }
    if (!user.customer?.legacyInvitationSentAt) {
      const invited = await adminRequest(config, tokenProvider, `mutation InviteCustomer($customerId: ID!) {
        customerSendAccountInviteEmail(customerId: $customerId) { userErrors { field message } }
      }`, { customerId: shopifyId })
      if (invited.customerSendAccountInviteEmail.userErrors?.length) throw new Error(invited.customerSendAccountInviteEmail.userErrors.map((error) => error.message).join('; '))
      migratedCount += 1
    }
    await prisma.customer.upsert({ where: { userId: user.id }, create: { userId: user.id, shopifyId, source: 'WEBSITE', lastSyncedAt: new Date(), legacyInvitationSentAt: new Date() }, update: { shopifyId, lastSyncedAt: new Date(), legacyInvitationSentAt: user.customer?.legacyInvitationSentAt || new Date() } })
  }
  logger.log(`Shopify customer migration: ${migratedCount} account invitation(s) sent`)
  return { migratedCount }
}
