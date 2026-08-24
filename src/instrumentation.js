/**
 * Next.js server instrumentation — Node cold starts (local `next start` / long-lived).
 * On Vercel, migrations primarily run in the build step (`npm run build`).
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
    const { spawn } = await load('node:child_process')
    const { join } = await load('node:path')
    const script = join(process.cwd(), 'scripts/run-migrations.mjs')

    await new Promise((resolve) => {
      const child = spawn(process.execPath, [script], {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'inherit',
      })
      child.on('error', (err) => {
        console.error('[instrumentation] Auto-migrate failed:', err.message)
        resolve()
      })
      child.on('exit', (code) => {
        if (code && code !== 0) {
          console.error(`[instrumentation] Auto-migrate exited with code ${code}`)
        }
        resolve()
      })
    })
  } catch (err) {
    console.error('[instrumentation] Auto-migrate failed:', err?.message || err)
  }
}
