/**
 * Apply MeterCalc schema to Supabase Postgres.
 * Prefer: POSTGRES_URL / POSTGRES_URL_NON_POOLING from Vercel ↔ Supabase.
 * Or: POSTGRES_PASSWORD (+ NEXT_PUBLIC_SUPABASE_URL) to try pooler hosts.
 *
 * Also runs automatically on Node server start (see src/instrumentation.js).
 * Skip with SKIP_DB_MIGRATE=1.
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

try {
  const result = await ensureDatabaseMigrated({ force })
  if (result.status === 'skipped') {
    console.error(
      result.reason === 'no-credentials'
        ? 'No Postgres URL/password. Set POSTGRES_URL or POSTGRES_PASSWORD (+ NEXT_PUBLIC_SUPABASE_URL).'
        : `Skipped: ${result.reason}`,
    )
    if (result.reason === 'no-credentials') process.exit(1)
  } else if (result.status === 'already-applied') {
    console.log(`Already applied: ${result.id} (pass --force to re-run)`)
  } else if (result.status === 'applied') {
    console.log(`Applied: ${result.id}`)
  }
} catch (err) {
  console.error('Migration failed:', err.message || err)
  process.exit(1)
}
