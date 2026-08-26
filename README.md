# MeterCalc / PlazaBills

Shared-building electricity billing. Next.js App Router so published cycle links get real WhatsApp / Open Graph previews.

The product name in the UI is **PlazaBills**.

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) after filling `.env` with a real Supabase project.

Schema migrations run during **`npm run build`** (including Vercel redeploys) and again on local Node server start. They use `POSTGRES_URL*` / `POSTGRES_PASSWORD`, are tracked in `public.schema_migrations`, and are idempotent.

On Vercel, the Supabase integration must provide `POSTGRES_URL` or `POSTGRES_URL_NON_POOLING` (or set `POSTGRES_PASSWORD`). A deploy without those vars fails the migrate step so an empty schema is not silent.

```bash
npm run db:migrate
npm run db:migrate -- --force
```

Set `SKIP_DB_MIGRATE=1` to disable. You can still paste `supabase-bootstrap.sql` into the Supabase SQL Editor if you prefer.

1. Sign in at `/superadmin` with `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD`
2. Create a plaza and set the plaza admin email + password
3. Sign in as that plaza admin on the home page

## Environment

Uses [Vercel ↔ Supabase Marketplace](https://supabase.com/docs/guides/integrations/vercel-marketplace) names (legacy aliases still work locally):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable / anon key (legacy: `NEXT_PUBLIC_SUPABASE_ANON_KEY`) |
| `SUPABASE_SECRET_KEY` | Server-only secret key (legacy: `SUPABASE_SERVICE_ROLE_KEY`) |
| `POSTGRES_PASSWORD` / `POSTGRES_URL` | DB access for auto-migrate on boot + `npm run db:migrate` |
| `SKIP_DB_MIGRATE` | Set to `1` to skip startup / CLI migrate |
| `SUPERADMIN_EMAIL` | Static superadmin login email (app-specific) |
| `SUPERADMIN_PASSWORD` | Static superadmin login password (app-specific) |
| `NEXT_PUBLIC_SITE_URL` | Absolute origin for OG / share links (e.g. `https://your-app.vercel.app`) |

## Multitenant plazas

Each plaza has a URL slug. Admin and public routes live under `/{plazaSlug}/…`:

| Path | Purpose |
|---|---|
| `/superadmin` | Create/list plazas (superadmin only) |
| `/{slug}/` | Plaza admin home |
| `/{slug}/worksheet` | New billing worksheet |
| `/{slug}/cycles/{id}/worksheet` | Edit a published cycle’s worksheet |
| `/{slug}/cycles/{id}` | Published cycle (shareable) |
| `/{slug}/settings` | Plaza settings |
| `/{slug}/businesses/{id}` | Tenant timeline |

Apply `supabase-migration-plazas.sql` on Supabase (adds `slug`, owner email, RLS). Legacy `/cycles/{id}` redirects to the plaza path when possible. Superadmin creates plaza admin Auth users (email + password) when provisioning a plaza.

## Share links & WhatsApp previews

Published cycles use: `/{plazaSlug}/cycles/{id}`.

Each cycle page exposes:

- `generateMetadata` — title + description (office bill, offset)
- `/{plazaSlug}/cycles/{id}/opengraph-image` — dynamic 1200×630 preview (totals + top tenants)

WhatsApp only fetches these over **public HTTPS**. For real previews:

1. Deploy (e.g. Vercel) with Supabase + superadmin env vars
2. Set `NEXT_PUBLIC_SITE_URL` to that deployment origin
3. Publish a cycle and share `/{slug}/cycles/{id}` (or use **WhatsApp** on the bills page)
4. If an old empty preview is cached, share a new cycle id or wait for WhatsApp’s cache to expire

Legacy hash links (`#/cycles/...`) are redirected to the path form on load.

## Payments & settings

- Per-tenant payment status: `awaiting` | `paid` | `unpaid` — conclude is blocked until none are awaiting
- Tenant timeline: `/{slug}/businesses/{id}` with invoice at `/{slug}/businesses/{id}/invoices/{cycleId}`
- Admin settings: `/{slug}/settings` (rate ₦/kWh, bank account, home banner)
- Apply SQL: bootstrap is applied automatically on boot (`supabase-bootstrap.sql`); optional incremental files remain in the repo for reference

## Scripts

- `npm run dev` — development server (port 3000); migrates on boot when DB creds exist
- `npm run build` — production build **then** apply schema (used by Vercel)
- `npm start` — serve production build; migrates on boot when DB creds exist
- `npm run db:migrate` — apply schema now (`--force` to re-run bootstrap)