/**
 * Env access for Next.js (client + server).
 *
 * NEXT_PUBLIC_* must be referenced as process.env.NEXT_PUBLIC_… literally —
 * dynamic process.env[name] is stripped from the client bundle.
 *
 * Naming follows Vercel ↔ Supabase Marketplace defaults, with legacy fallbacks.
 */
const PUBLIC_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  // Legacy alias (pre-publishable-key naming)
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
}

export function env(name, fallback = '') {
  if (Object.prototype.hasOwnProperty.call(PUBLIC_ENV, name)) {
    const value = PUBLIC_ENV[name]
    return value != null && value !== '' ? value : fallback
  }
  if (typeof process !== 'undefined' && process.env && process.env[name] != null) {
    return process.env[name]
  }
  return fallback
}

/** Project URL — Vercel sets NEXT_PUBLIC_SUPABASE_URL (+ SUPABASE_URL server-side). */
export function getSupabaseUrl() {
  return env('NEXT_PUBLIC_SUPABASE_URL') || env('SUPABASE_URL')
}

/**
 * Browser/anon key — Vercel sets NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 * (and SUPABASE_PUBLISHABLE_KEY). Legacy: NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */
export function getSupabasePublishableKey() {
  return (
    env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
    || env('SUPABASE_PUBLISHABLE_KEY')
    || env('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  )
}

/**
 * Server-only secret — Vercel sets SUPABASE_SECRET_KEY.
 * Legacy: SUPABASE_SERVICE_ROLE_KEY.
 */
export function getSupabaseSecretKey() {
  return env('SUPABASE_SECRET_KEY') || env('SUPABASE_SERVICE_ROLE_KEY')
}

export function siteUrl() {
  const raw = env('NEXT_PUBLIC_SITE_URL', '')
  if (raw) return raw.replace(/\/$/, '')
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return 'http://localhost:3000'
}

export function isSupabaseConfigured() {
  const url = getSupabaseUrl()
  const key = getSupabasePublishableKey()
  if (!url || !key) return false
  if (url.includes('your-project-id')) return false
  if (
    key.includes('your-anon-public-key')
    || key.includes('your-publishable-key')
  ) {
    return false
  }
  return true
}
