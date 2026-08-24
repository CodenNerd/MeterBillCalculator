import fs from 'node:fs'
import path from 'node:path'
import dns from 'node:dns'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url))

/** Bump when supabase-bootstrap.sql changes meaningfully. */
export const BOOTSTRAP_MIGRATION_ID = '2026-08-24-bootstrap'

/** Advisory lock key so concurrent serverless starts don't race. */
const ADVISORY_LOCK_KEY = 872314559

let migratePromise = null

function projectRefFromUrl(url) {
  try {
    const host = new URL(url).hostname
    const match = host.match(/^([a-z0-9-]+)\.supabase\.co$/i)
    return match ? match[1] : null
  } catch {
    return null
  }
}

export function candidateDatabaseUrls(env = process.env) {
  const direct = [
    env.POSTGRES_URL_NON_POOLING,
    env.POSTGRES_URL,
    env.DATABASE_URL,
  ].filter(Boolean)
  if (direct.length) return [...new Set(direct)]

  const password = env.POSTGRES_PASSWORD || env.SUPABASE_DB_PASSWORD
  const ref = projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || '')
  if (!password || !ref) return []

  const encoded = encodeURIComponent(password)
  const regions = [
    env.SUPABASE_REGION,
    'eu-west-1',
    'eu-central-1',
    'eu-west-2',
    'us-east-1',
    'us-west-1',
    'ap-southeast-1',
  ].filter(Boolean)

  const urls = []
  for (const region of regions) {
    for (const prefix of ['aws-1', 'aws-0']) {
      urls.push(
        `postgresql://postgres.${ref}:${encoded}@${prefix}-${region}.pooler.supabase.com:5432/postgres`,
      )
      urls.push(
        `postgresql://postgres.${ref}:${encoded}@${prefix}-${region}.pooler.supabase.com:6543/postgres`,
      )
    }
  }
  urls.push(`postgresql://postgres:${encoded}@db.${ref}.supabase.co:5432/postgres`)
  return urls
}

async function connectFirstAvailable(urls) {
  try {
    dns.setDefaultResultOrder('ipv4first')
  } catch {
    /* older Node */
  }

  let lastError = null
  for (const connectionString of urls) {
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 12000,
    })
    try {
      await client.connect()
      return client
    } catch (err) {
      lastError = err
      try { await client.end() } catch { /* ignore */ }
    }
  }
  throw lastError || new Error('Could not connect to Postgres')
}

function readBootstrapSql() {
  const candidates = [
    path.join(process.cwd(), 'supabase-bootstrap.sql'),
    path.join(MODULE_DIR, '..', '..', 'supabase-bootstrap.sql'),
    path.join(MODULE_DIR, 'supabase-bootstrap.sql'),
  ]
  for (const sqlPath of candidates) {
    if (fs.existsSync(sqlPath)) return fs.readFileSync(sqlPath, 'utf8')
  }
  throw new Error(
    `Missing supabase-bootstrap.sql (tried: ${candidates.join(', ')})`,
  )
}

/**
 * Apply schema migrations once per process (idempotent across deploys).
 * No-ops when SKIP_DB_MIGRATE=1 or no Postgres credentials are configured.
 */
export async function ensureDatabaseMigrated({ force = false } = {}) {
  if (process.env.SKIP_DB_MIGRATE === '1' || process.env.SKIP_DB_MIGRATE === 'true') {
    return { status: 'skipped', reason: 'SKIP_DB_MIGRATE' }
  }

  // Avoid running during `next build` when env/network may be unavailable.
  if (process.env.NEXT_PHASE === 'phase-production-build' && !force) {
    return { status: 'skipped', reason: 'build' }
  }

  if (migratePromise && !force) return migratePromise

  migratePromise = (async () => {
    const urls = candidateDatabaseUrls()
    if (urls.length === 0) {
      console.warn(
        '[migrate] No Postgres credentials (POSTGRES_URL / POSTGRES_PASSWORD). Skipping auto-migrate.',
      )
      return { status: 'skipped', reason: 'no-credentials' }
    }

    const client = await connectFirstAvailable(urls)
    try {
      await client.query('select pg_advisory_lock($1)', [ADVISORY_LOCK_KEY])

      await client.query(`
        create table if not exists public.schema_migrations (
          id text primary key,
          applied_at timestamptz not null default now()
        )
      `)

      const { rows } = await client.query(
        'select 1 from public.schema_migrations where id = $1',
        [BOOTSTRAP_MIGRATION_ID],
      )

      if (rows.length > 0 && !force) {
        return { status: 'already-applied', id: BOOTSTRAP_MIGRATION_ID }
      }

      console.log(`[migrate] Applying ${BOOTSTRAP_MIGRATION_ID}…`)
      const sql = readBootstrapSql()
      await client.query(sql)
      await client.query(
        `insert into public.schema_migrations (id) values ($1)
         on conflict (id) do update set applied_at = now()`,
        [BOOTSTRAP_MIGRATION_ID],
      )
      console.log(`[migrate] OK (${BOOTSTRAP_MIGRATION_ID})`)
      return { status: 'applied', id: BOOTSTRAP_MIGRATION_ID }
    } finally {
      try {
        await client.query('select pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY])
      } catch { /* ignore */ }
      await client.end().catch(() => {})
    }
  })().catch((err) => {
    // Allow retry on next cold start / CLI invoke.
    migratePromise = null
    throw err
  })

  return migratePromise
}
