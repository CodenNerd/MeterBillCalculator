# MeterCalc

Shared-building electricity billing. Next.js App Router so published cycle links get real WhatsApp / Open Graph previews.

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). With `NEXT_PUBLIC_USE_LOCAL_STUB=true`, use **Start with sample data** on the login screen (no Supabase needed).

## Environment

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_USE_LOCAL_STUB` | `true` / `false` — force local stub vs Supabase |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_SITE_URL` | Absolute origin for OG / share links (e.g. `https://your-app.vercel.app`) |

## Share links & WhatsApp previews

Published cycles use path URLs: `/cycles/{id}`.

Each cycle page exposes:

- `generateMetadata` — title + description (office bill, offset)
- `/cycles/{id}/opengraph-image` — dynamic 1200×630 preview (totals + top tenants)

WhatsApp only fetches these over **public HTTPS**. Local stub data lives in the browser, so crawlers cannot see it. For real previews:

1. Deploy (e.g. Vercel) with Supabase credentials and `NEXT_PUBLIC_USE_LOCAL_STUB=false`
2. Set `NEXT_PUBLIC_SITE_URL` to that deployment origin
3. Publish a cycle and share `/cycles/{id}` (or use **WhatsApp** on the bills page)
4. If an old empty preview is cached, share a new cycle id or wait for WhatsApp’s cache to expire

Legacy hash links (`#/cycles/...`) are redirected to the path form on load.

## Scripts

- `npm run dev` — development server (port 3000)
- `npm run build` — production build
- `npm start` — serve production build
