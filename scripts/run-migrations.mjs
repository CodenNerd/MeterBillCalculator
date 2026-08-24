#!/usr/bin/env node
/**
 * Apply supabase-bootstrap.sql to the linked Supabase Postgres database.
 *
 * Requires one of:
 *   DATABASE_URL=postgresql://...
 *   SUPABASE_DB_PASSWORD=<Dashboard → Settings → Database password>
 *
 * Uses NEXT_PUBLIC_SUPABASE_URL to derive the project ref when only the password is set.
 * Prefers the Supabase pooler (IPv4) because many projects' db.* hosts are IPv6-only.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import dns from 'node:dns'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const text = fs.readFileSync(filePath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] == null) process.env[key] = value
  }
}

loadEnvFile(path.join(root, '.env.local'))
loadEnvFile(path.join(root, '.env'))

function projectRefFromUrl(url) {
  try {
    const host = new URL(url).hostname
    const match = host.match(/^([a-z0-9-]+)\.supabase\.co$/i)
    return match ? match[1] : null
  } catch {
    return null
  }
}

const POOLER_REGIONS = [
  process.env.SUPABASE_REGION,
  'eu-west-1',
  'eu-central-1',
  'eu-west-2',
  'us-east-1',
  'us-west-1',
  'ap-southeast-1',
].filter(Boolean)

function candidateUrls() {
  if (process.env.DATABASE_URL) return [process.env.DATABASE_URL]

  const password = process.env.SUPABASE_DB_PASSWORD
  const ref = projectRefFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL || '')
  if (!password || !ref) return []

  const encoded = encodeURIComponent(password)
  const urls = []

  for (const region of POOLER_REGIONS) {
    for (const prefix of ['aws-1', 'aws-0']) {
      // Session mode (5432) preferred for DDL; transaction (6543) as fallback
      urls.push(
        `postgresql://postgres.${ref}:${encoded}@${prefix}-${region}.pooler.supabase.com:5432/postgres`,
      )
      urls.push(
        `postgresql://postgres.${ref}:${encoded}@${prefix}-${region}.pooler.supabase.com:6543/postgres`,
      )
    }
  }

  // Direct host (often IPv6-only)
  urls.push(`postgresql://postgres:${encoded}@db.${ref}.supabase.co:5432/postgres`)

  return urls
}

async function tryConnect(pg, connectionString) {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 12000,
  })
  await client.connect()
  return client
}

async function main() {
  let pg
  try {
    pg = require('pg')
  } catch {
    console.error('Installing pg…')
    const { execSync } = await import('node:child_process')
    execSync('npm install pg --no-save', { cwd: root, stdio: 'inherit' })
    pg = require('pg')
  }

  // Prefer IPv4 for pooler; allow IPv6 fallback for direct db.* hosts
  try {
    dns.setDefaultResultOrder('ipv4first')
  } catch {
    /* older Node */
  }

  const urls = candidateUrls()
  if (urls.length === 0) {
    console.error(`Missing database credentials.

Add ONE of these to .env:

  SUPABASE_DB_PASSWORD=your-database-password
  # from Supabase Dashboard → Project Settings → Database → Database password

or

  DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres

Optional: SUPABASE_REGION=eu-west-1 (speeds up pooler discovery)

Then re-run: npm run db:migrate
`)
    process.exit(1)
  }

  const sqlPath = path.join(root, 'supabase-bootstrap.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')

  let client = null
  let lastError = null
  for (const url of urls) {
    const host = url.replace(/:[^:@/]+@/, ':****@').match(/@([^/]+)/)?.[1] || 'unknown'
    process.stdout.write(`Trying ${host}… `)
    try {
      client = await tryConnect(pg, url)
      console.log('connected')
      break
    } catch (err) {
      console.log('failed')
      lastError = err
    }
  }

  if (!client) {
    console.error('Migration failed:', lastError?.message || 'could not connect')
    console.error(
      'Tip: copy the Session pooler URI from Dashboard → Connect → ORMs, set DATABASE_URL, retry.',
    )
    process.exit(1)
  }

  try {
    console.log('Applying supabase-bootstrap.sql…')
    await client.query(sql)
    const { rows } = await client.query(`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in ('complexes', 'businesses', 'billing_cycles', 'cycle_business_bills')
      order by table_name
    `)
    console.log('OK. Tables present:', rows.map(r => r.table_name).join(', '))
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
