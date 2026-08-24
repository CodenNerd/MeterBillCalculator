import { createClient } from '@supabase/supabase-js'
import { env } from './env'

/**
 * Server-only Supabase client with the service role key.
 * Never import this into client components.
 */
export function createServiceSupabase() {
  const url = env('NEXT_PUBLIC_SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key || url.includes('your-project-id') || key.includes('your-service')) {
    throw new Error('Supabase service role is not configured. Set SUPABASE_SERVICE_ROLE_KEY.')
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function getSuperadminCredentials() {
  const email = (env('SUPERADMIN_EMAIL') || '').trim().toLowerCase()
  const password = env('SUPERADMIN_PASSWORD') || ''
  return { email, password }
}

export function isConfiguredSuperadmin(email, password) {
  const cfg = getSuperadminCredentials()
  if (!cfg.email || !cfg.password) return false
  return (
    String(email || '').trim().toLowerCase() === cfg.email
    && String(password || '') === cfg.password
  )
}

/** Paginate Auth admin users until email match (case-insensitive). */
export async function findAuthUserByEmail(admin, email) {
  const target = String(email || '').trim().toLowerCase()
  if (!target) return null
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(error.message)
    const users = data?.users || []
    const found = users.find(u => (u.email || '').toLowerCase() === target)
    if (found) return found
    if (users.length < 200) break
  }
  return null
}
