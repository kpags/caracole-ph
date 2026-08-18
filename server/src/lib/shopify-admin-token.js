const REFRESH_BUFFER_SECONDS = 300

export function createShopifyAdminTokenProvider(config, fetchApi = globalThis.fetch, now = () => Date.now()) {
  let cached = null

  return {
    async getAccessToken() {
      if (cached && cached.expiresAt > now()) return cached.token
      const response = await fetchApi(`https://${config.SHOPIFY_STORE_DOMAIN}/admin/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'client_credentials', client_id: config.SHOPIFY_CLIENT_ID, client_secret: config.SHOPIFY_CLIENT_SECRET }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload.access_token) throw new Error(payload.error_description || payload.error || 'Unable to obtain a Shopify Admin API access token')
      const scopes = String(payload.scope || '').split(/[ ,]+/).filter(Boolean)
      if (!scopes.includes('read_products') && !scopes.includes('write_products')) throw new Error('The Shopify app access token is missing product read access (read_products or write_products)')
      const expiresIn = Number(payload.expires_in)
      cached = { token: payload.access_token, expiresAt: now() + Math.max(0, (Number.isFinite(expiresIn) ? expiresIn : 0) - REFRESH_BUFFER_SECONDS) * 1000 }
      return cached.token
    },
  }
}
