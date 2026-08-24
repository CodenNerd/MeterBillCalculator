/**
 * Next.js server instrumentation — runs once when the Node server boots.
 * Keep this file free of Node built-ins so the Edge compile of instrumentation succeeds.
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.SKIP_DB_MIGRATE === '1' || process.env.SKIP_DB_MIGRATE === 'true') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return

  try {
    // Escape the webpack graph (Edge also compiles instrumentation.js).
    const load = new Function('u', 'return import(u)')
    const href = `file://${process.cwd()}/src/instrumentation.node.mjs`
    const { runStartupMigrations } = await load(href)
    await runStartupMigrations()
  } catch (err) {
    console.error('[instrumentation] Auto-migrate failed:', err?.message || err)
  }
}
