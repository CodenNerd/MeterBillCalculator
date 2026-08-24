/**
 * Node-only startup migrations (loaded via file: URL from instrumentation.js).
 */
import { ensureDatabaseMigrated } from './lib/dbMigrate.mjs'

export async function runStartupMigrations() {
  const result = await ensureDatabaseMigrated()
  if (result.status === 'applied') {
    console.log('[instrumentation] Database schema migrated')
  } else if (result.status === 'already-applied') {
    console.log('[instrumentation] Database schema up to date')
  } else if (result.status === 'skipped') {
    console.log(`[instrumentation] Auto-migrate skipped (${result.reason})`)
  }
}
