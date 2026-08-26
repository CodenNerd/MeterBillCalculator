import fs from 'node:fs'
import path from 'node:path'
import dns from 'node:dns'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url))

/** Bump when supabase-bootstrap.sql changes meaningfully. */
export const BOOTSTRAP_MIGRATION_ID = '2026-08-24-bootstrap'

/**
 * Ordered list of migrations. Each id is recorded in public.schema_migrations.
 * Add new entries here when shipping incremental SQL files later.
 */
export const MIGRATIONS = [
  {
    id: BOOTSTRAP_MIGRATION_ID,
    file: 'supabase-bootstrap.sql',
    description: 'Full MeterCalc schema (tables, RLS, plazas, payments)',
  },
  {
    id: '2026-08-26-published-at',
    file: 'supabase-migration-published-at.sql',
    description: 'billing_cycles.published_at for date + publish-time ordering',
  },
]

/** Advisory lock key so concurrent serverless starts don't race. */
const ADVISORY_LOCK_KEY = 872314559

let migratePromise = null

function log(level, message, extra) {
  const line = extra == null ? `[migrate] ${message}` : `[migrate] ${message} ${extra}`
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

function redactConnectionString(url) {
  try {
    const u = new URL(url)
    if (u.password) u.password = '****'
    return `${u.protocol}//${u.username}:****@${u.host}${u.pathname}`
  } catch {
    return url.replace(/:([^:@/]+)@/, ':****@')
  }
}

function hostFromUrl(url) {
  try {
    return new URL(url).host
  } catch {
    return url.replace(/:[^:@/]+@/, ':****@').match(/@([^/]+)/)?.[1] || 'unknown'
  }
}

function projectRefFromUrl(url) {
  try {
    const host = new URL(url).hostname
    const match = host.match(/^([a-z0-9-]+)\.supabase\.co$/i)
    return match ? match[1] : null
  } catch {
    return null
  }
}

function formatPgError(err) {
  if (!err) return 'unknown error'
  const parts = [err.message || String(err)]
  if (err.code) parts.push(`code=${err.code}`)
  if (err.detail) parts.push(`detail=${err.detail}`)
  if (err.hint) parts.push(`hint=${err.hint}`)
  if (err.position) parts.push(`position=${err.position}`)
  if (err.where) parts.push(`where=${err.where}`)
  if (err.schema) parts.push(`schema=${err.schema}`)
  if (err.table) parts.push(`table=${err.table}`)
  return parts.join(' | ')
}

/**
 * Resolve DB URLs and which env source provided them (never logs secrets).
 */
export function resolveDatabaseTargets(env = process.env) {
  if (env.POSTGRES_URL_NON_POOLING) {
    return {
      source: 'POSTGRES_URL_NON_POOLING',
      urls: [env.POSTGRES_URL_NON_POOLING],
    }
  }
  if (env.POSTGRES_URL) {
    return { source: 'POSTGRES_URL', urls: [env.POSTGRES_URL] }
  }
  if (env.DATABASE_URL) {
    return { source: 'DATABASE_URL', urls: [env.DATABASE_URL] }
  }

  const password = env.POSTGRES_PASSWORD || env.SUPABASE_DB_PASSWORD
  const passwordSource = env.POSTGRES_PASSWORD
    ? 'POSTGRES_PASSWORD'
    : env.SUPABASE_DB_PASSWORD
      ? 'SUPABASE_DB_PASSWORD'
      : null
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || ''
  const ref = projectRefFromUrl(supabaseUrl)
  if (!password || !ref) {
    return {
      source: null,
      urls: [],
      missing: {
        password: !password,
        projectRef: !ref,
        supabaseUrl: Boolean(supabaseUrl),
      },
    }
  }

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

  return {
    source: `${passwordSource} + project ref ${ref}`,
    urls,
    projectRef: ref,
  }
}

/** @deprecated use resolveDatabaseTargets */
export function candidateDatabaseUrls(env = process.env) {
  return resolveDatabaseTargets(env).urls
}

/**
 * Vercel/Supabase URLs often include sslmode=require. Recent `pg` treats that like
 * verify-full, which fails on Supabase's certificate chain (SELF_SIGNED_CERT_IN_CHAIN).
 * Strip sslmode from the URL and force TLS without CA verification.
 */
function connectionConfig(connectionString) {
  let cleaned = connectionString
  try {
    const u = new URL(connectionString)
    u.searchParams.delete('sslmode')
    u.searchParams.delete('ssl')
    u.searchParams.delete('uselibpqcompat')
    cleaned = u.toString()
  } catch {
    cleaned = String(connectionString)
      .replace(/([?&])sslmode=[^&]*/gi, '$1')
      .replace(/([?&])ssl=[^&]*/gi, '$1')
      .replace(/[?&]$/, '')
      .replace(/\?&/, '?')
  }
  return {
    connectionString: cleaned,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 12000,
  }
}

async function connectFirstAvailable(urls) {
  try {
    dns.setDefaultResultOrder('ipv4first')
  } catch {
    /* older Node */
  }

  let lastError = null
  log('info', `Connecting… (${urls.length} candidate host(s))`)
  for (const connectionString of urls) {
    const host = hostFromUrl(connectionString)
    const client = new Client(connectionConfig(connectionString))
    try {
      await client.connect()
      log('info', `Connected to ${host}`)
      return { client, host, redacted: redactConnectionString(connectionString) }
    } catch (err) {
      lastError = err
      log('warn', `Connect failed (${host}): ${formatPgError(err)}`)
      try { await client.end() } catch { /* ignore */ }
    }
  }
  throw lastError || new Error('Could not connect to Postgres')
}

function resolveSqlFile(fileName) {
  const candidates = [
    path.join(process.cwd(), fileName),
    path.join(MODULE_DIR, '..', '..', fileName),
    path.join(MODULE_DIR, fileName),
  ]
  for (const sqlPath of candidates) {
    if (fs.existsSync(sqlPath)) return sqlPath
  }
  return null
}

function readMigrationSql(migration) {
  const sqlPath = resolveSqlFile(migration.file)
  if (!sqlPath) {
    throw new Error(
      `Missing ${migration.file} for migration ${migration.id} (cwd=${process.cwd()})`,
    )
  }
  const sql = fs.readFileSync(sqlPath, 'utf8')
  return { sqlPath, sql, bytes: Buffer.byteLength(sql, 'utf8') }
}

async function listAppliedMigrations(client) {
  const { rows } = await client.query(
    'select id, applied_at from public.schema_migrations order by applied_at asc, id asc',
  )
  return rows
}

async function ensureMigrationsTable(client) {
  await client.query(`
    create table if not exists public.schema_migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    )
  `)
}

/**
 * Apply schema migrations once per process (idempotent across deploys).
 * No-ops when SKIP_DB_MIGRATE=1 or no Postgres credentials are configured.
 */
export async function ensureDatabaseMigrated({ force = false } = {}) {
  const startedAt = Date.now()
  const envLabel = process.env.VERCEL
    ? `vercel/${process.env.VERCEL_ENV || 'unknown'}`
    : 'local'

  log('info', '======== MeterCalc DB migrate start ========')
  log('info', `Environment: ${envLabel}`)
  log('info', `Force re-apply: ${force}`)
  log(
    'info',
    `Planned migrations (${MIGRATIONS.length}): ${MIGRATIONS.map((m) => m.id).join(', ') || '(none)'}`,
  )

  if (process.env.SKIP_DB_MIGRATE === '1' || process.env.SKIP_DB_MIGRATE === 'true') {
    log('warn', 'SKIP_DB_MIGRATE is set — not running any migrations')
    log('info', '======== MeterCalc DB migrate end (skipped) ========')
    return { status: 'skipped', reason: 'SKIP_DB_MIGRATE', applied: [], skipped: [], failed: [] }
  }

  // Avoid running during `next build` when env/network may be unavailable.
  if (process.env.NEXT_PHASE === 'phase-production-build' && !force) {
    log('info', 'Inside next build phase — deferring migrate to post-build script')
    log('info', '======== MeterCalc DB migrate end (deferred) ========')
    return { status: 'skipped', reason: 'build', applied: [], skipped: [], failed: [] }
  }

  if (migratePromise && !force) return migratePromise

  migratePromise = (async () => {
    const target = resolveDatabaseTargets()
    if (target.urls.length === 0) {
      log('error', 'No Postgres credentials found')
      log(
        'error',
        `Checked: POSTGRES_URL_NON_POOLING, POSTGRES_URL, DATABASE_URL, POSTGRES_PASSWORD/SUPABASE_DB_PASSWORD + NEXT_PUBLIC_SUPABASE_URL (missing password=${target.missing?.password}, missing project ref=${target.missing?.projectRef}, supabase url present=${target.missing?.supabaseUrl})`,
      )
      log('info', '======== MeterCalc DB migrate end (no-credentials) ========')
      return {
        status: 'skipped',
        reason: 'no-credentials',
        applied: [],
        skipped: [],
        failed: [],
      }
    }

    log('info', `Credential source: ${target.source}`)
    if (target.projectRef) log('info', `Supabase project ref: ${target.projectRef}`)

    let client
    let host
    try {
      ;({ client, host } = await connectFirstAvailable(target.urls))
    } catch (err) {
      log('error', `Could not connect to any Postgres host: ${formatPgError(err)}`)
      log('info', '======== MeterCalc DB migrate end (connect-failed) ========')
      throw err
    }

    const applied = []
    const skipped = []
    const failed = []

    try {
      log('info', 'Acquiring advisory lock…')
      await client.query('select pg_advisory_lock($1)', [ADVISORY_LOCK_KEY])
      log('info', 'Advisory lock acquired')

      await ensureMigrationsTable(client)

      const previouslyApplied = await listAppliedMigrations(client)
      log(
        'info',
        previouslyApplied.length
          ? `Already in schema_migrations (${previouslyApplied.length}): ${previouslyApplied
              .map((r) => `${r.id}@${r.applied_at?.toISOString?.() || r.applied_at}`)
              .join(', ')}`
          : 'schema_migrations is empty (first run on this database)',
      )

      const appliedIds = new Set(previouslyApplied.map((r) => r.id))

      for (const migration of MIGRATIONS) {
        const already = appliedIds.has(migration.id)
        if (already && !force) {
          log('info', `SKIP  ${migration.id} — already applied (${migration.description})`)
          skipped.push({ id: migration.id, reason: 'already-applied' })
          continue
        }

        if (already && force) {
          log('warn', `FORCE ${migration.id} — re-applying (${migration.description})`)
        } else {
          log('info', `APPLY ${migration.id} — ${migration.description}`)
        }

        let sqlPath
        let bytes
        try {
          ;({ sqlPath, sql: migration._sql, bytes } = readMigrationSql(migration))
          log('info', `  SQL file: ${sqlPath} (${bytes} bytes)`)
          const t0 = Date.now()
          await client.query(migration._sql)
          const ms = Date.now() - t0
          await client.query(
            `insert into public.schema_migrations (id) values ($1)
             on conflict (id) do update set applied_at = now()`,
            [migration.id],
          )
          log('info', `  OK ${migration.id} in ${ms}ms`)
          applied.push({ id: migration.id, ms, file: migration.file })
        } catch (err) {
          const formatted = formatPgError(err)
          log('error', `  FAIL ${migration.id}: ${formatted}`)
          if (sqlPath) log('error', `  Failed SQL file: ${sqlPath}`)
          failed.push({ id: migration.id, error: formatted, file: migration.file })
          throw err
        } finally {
          delete migration._sql
        }
      }

      const after = await listAppliedMigrations(client)
      log(
        'info',
        `schema_migrations now (${after.length}): ${after.map((r) => r.id).join(', ') || '(empty)'}`,
      )

      // Sanity: core tables present?
      try {
        const { rows: tables } = await client.query(`
          select table_name
          from information_schema.tables
          where table_schema = 'public'
            and table_type = 'BASE TABLE'
          order by table_name
        `)
        log(
          'info',
          `Public tables (${tables.length}): ${tables.map((t) => t.table_name).join(', ') || '(none)'}`,
        )
      } catch (err) {
        log('warn', `Could not list public tables: ${formatPgError(err)}`)
      }

      const elapsed = Date.now() - startedAt
      const status =
        failed.length > 0
          ? 'failed'
          : applied.length > 0
            ? 'applied'
            : skipped.length > 0
              ? 'already-applied'
              : 'noop'

      log(
        'info',
        `Summary: status=${status} applied=${applied.length} skipped=${skipped.length} failed=${failed.length} host=${host} elapsed=${elapsed}ms`,
      )
      log('info', '======== MeterCalc DB migrate end ========')

      return {
        status,
        id: applied[0]?.id || skipped[0]?.id || null,
        applied,
        skipped,
        failed,
        host,
        elapsedMs: elapsed,
      }
    } finally {
      try {
        await client.query('select pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY])
        log('info', 'Advisory lock released')
      } catch { /* ignore */ }
      await client.end().catch(() => {})
    }
  })().catch((err) => {
    migratePromise = null
    log('error', `Fatal: ${formatPgError(err)}`)
    log('info', '======== MeterCalc DB migrate end (error) ========')
    throw err
  })

  return migratePromise
}
