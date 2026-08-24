/**
 * Env access that works in Next.js (client + server).
 */
export function env(name, fallback = '') {
  if (typeof process !== 'undefined' && process.env && process.env[name] != null) {
    return process.env[name]
  }
  return fallback
}

export function siteUrl() {
  const raw = env('NEXT_PUBLIC_SITE_URL', '')
  if (raw) return raw.replace(/\/$/, '')
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}`
  }
  return 'http://localhost:3000'
}
