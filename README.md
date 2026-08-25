# Caracole PH

## Storefront (Nuxt SSR)

The public storefront now uses Nuxt with server-side rendering for crawlable
collection and product pages. The admin app remains the separate Vue/Vite app
inside `admin/`.

```sh
npm run dev
```

The local storefront is available at `http://localhost:5173`. Set
`NUXT_PUBLIC_API_BASE_URL` to the public Express API address; the existing
`VITE_API_URL` value continues to work during the transition.

```sh
npm run build
```

This creates the Cloudflare-compatible SSR worker used by the hosted
storefront. For a standalone Node SSR server, use `npm run build:node` followed
by `npm run start`.

## Full local stack

```sh
docker compose up --build
```

This starts every service together:

- Storefront: `http://localhost:5173`
- Vue admin: `http://localhost:8080`
- API health: `http://localhost:3000/health`
- Prisma Studio: `http://127.0.0.1:5555`

The admin deliberately remains a separate Vue application on port `8080`; it
is not served through the Nuxt storefront's `/admin` path.

## Local database maintenance

Prisma Studio is a development-only database browser. It is bound to localhost and starts with normal Compose commands.

```sh
docker compose up
```

Open `http://127.0.0.1:5555` (or the value of `PRISMA_STUDIO_PORT`) to inspect or remove local test data.
