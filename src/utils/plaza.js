/** Plaza slug helpers and path builders. */

export const RESERVED_PLAZA_SLUGS = new Set([
  'superadmin',
  'bills',
  'api',
  'auth',
  'login',
  'settings',
  'cycle',
  'cycles',
  'worksheet',
  'businesses',
  'admin',
  'app',
  'www',
  'static',
  '_next',
  'favicon.ico',
])

export function slugifyPlazaName(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'plaza'
}

export function isValidPlazaSlug(slug) {
  if (!slug || typeof slug !== 'string') return false
  if (RESERVED_PLAZA_SLUGS.has(slug)) return false
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 48
}

/** Build a path under a plaza: plazaPath('kmsplaza', '/cycles/1') → '/kmsplaza/cycles/1' */
export function plazaPath(slug, path = '/') {
  if (!slug) return path.startsWith('/') ? path : `/${path}`
  const rest = !path || path === '/'
    ? ''
    : (path.startsWith('/') ? path : `/${path}`)
  return `/${slug}${rest}`
}
