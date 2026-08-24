/**
 * Apply MeterCalc schema to Supabase Postgres.
 * Prefer: POSTGRES_URL / POSTGRES_URL_NON_POOLING from Vercel ↔ Supabase.
 * Or: POSTGRES_PASSWORD (+ NEXT_PUBLIC_SUPABASE_URL) to try pooler hosts.
 *
 * Runs on Vercel during `next build` (see package.json) and on Node server
 * start locally (see src/instrumentation.js). Skip with SKIP_DB_MIGRATE=1.
 *
 * Look for `[migrate]` lines in the Vercel build log for full status.
 */
import fs from 'node:fs'
import path from 'node:path'
import { ensureDatabaseMigrated, MIGRATIONS } from '../src/lib/dbMigrate.mjs'

/** Minimal .env loader (no dotenv dependency). */
function loadEnvFile(filePath) {
  const full = path.resolve(filePath)
  if (!fs.existsSync(full)) return
  for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

const force = process.argv.includes('--force')
const onVercel = Boolean(process.env.VERCEL)

console.log('')
console.log('[migrate] >>> post-build / CLI migration runner')
console.log(`[migrate] >>> Vercel=${onVercel} env=${process.env.VERCEL_ENV || 'n/a'} force=${force}`)
console.log(`[migrate] >>> Known migrations: ${MIGRATIONS.map((m) => m.id).join(', ')}`)
console.log('')

try {
  const result = await ensureDatabaseMigrated({ force })

  if (result.status === 'skipped') {
    if (result.reason === 'no-credentials') {
      const msg =
        'No Postgres URL/password. Set POSTGRES_URL or POSTGRES_PASSWORD (+ NEXT_PUBLIC_SUPABASE_URL).'
      if (onVercel) {
        console.error(`[migrate] FATAL: ${msg} Required on Vercel for schema deploy.`)
        process.exit(1)
      }
      console.warn(`[migrate] ${msg} Skipping (local).`)
      process.exit(0)
    }
    console.log(`[migrate] Runner finished: skipped (${result.reason})`)
    process.exit(0)
  }

  if (result.failed?.length) {
    console.error('[migrate] Runner finished: FAILED')
    for (const f of result.failed) {
      console.error(`[migrate]   - ${f.id}: ${f.error}`)
    }
    process.exit(1)
  }

  console.log('[migrate] Runner finished: OK')
  if (result.applied?.length) {
    console.log(
      `[migrate]   Applied: ${result.applied.map((a) => `${a.id} (${a.ms}ms)`).join(', ')}`,
    )
  }
  if (result.skipped?.length) {
    console.log(
      `[migrate]   Skipped: ${result.skipped.map((s) => `${s.id} (${s.reason})`).join(', ')}`,
    )
  }
  if (result.host) console.log(`[migrate]   Host: ${result.host}`)
  if (result.elapsedMs != null) console.log(`[migrate]   Elapsed: ${result.elapsedMs}ms`)
  console.log('')
} catch (err) {
  console.error('[migrate] Runner finished: ERROR')
  console.error('[migrate]', err?.stack || err?.message || err)
  process.exit(1)
}
