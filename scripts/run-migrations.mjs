/**
 * Apply MeterCalc schema to Supabase Postgres.
 * Prefer: POSTGRES_URL / POSTGRES_URL_NON_POOLING from Vercel ↔ Supabase.
 * Or: POSTGRES_PASSWORD (+ NEXT_PUBLIC_SUPABASE_URL) to try pooler hosts.
 *
 * Runs on Vercel during `next build` (see package.json) and on Node server
 * start locally (see src/instrumentation.js). Skip with SKIP_DB_MIGRATE=1.
 */
import fs from 'node:fs'
import path from 'node:path'
import { ensureDatabaseMigrated } from '../src/lib/dbMigrate.mjs'

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

try {
  const result = await ensureDatabaseMigrated({ force })
  if (result.status === 'skipped') {
    if (result.reason === 'no-credentials') {
      const msg =
        'No Postgres URL/password. Set POSTGRES_URL or POSTGRES_PASSWORD (+ NEXT_PUBLIC_SUPABASE_URL).'
      if (onVercel) {
        console.error(`[migrate] ${msg} Required on Vercel for schema deploy.`)
        process.exit(1)
      }
      console.warn(`[migrate] ${msg} Skipping (local).`)
      process.exit(0)
    }
    console.log(`[migrate] Skipped: ${result.reason}`)
  } else if (result.status === 'already-applied') {
    console.log(`[migrate] Already applied: ${result.id} (pass --force to re-run)`)
  } else if (result.status === 'applied') {
    console.log(`[migrate] Applied: ${result.id}`)
  }
} catch (err) {
  console.error('[migrate] Migration failed:', err.message || err)
  process.exit(1)
}
