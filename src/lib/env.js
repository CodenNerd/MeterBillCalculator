/**
 * Env access for Next.js (client + server).
 *
 * NEXT_PUBLIC_* must be referenced as process.env.NEXT_PUBLIC_… literally —
 * dynamic process.env[name] is stripped from the client bundle.
 */
const PUBLIC_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
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

export function siteUrl() {
  const raw = env('NEXT_PUBLIC_SITE_URL', '')
  if (raw) return raw.replace(/\/$/, '')
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return 'http://localhost:3000'
}

export function isSupabaseConfigured() {
  const url = env('NEXT_PUBLIC_SUPABASE_URL')
  const key = env('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (!url || !key) return false
  if (url.includes('your-project-id')) return false
  if (key.includes('your-anon-public-key')) return false
  return true
}
