import { supabase } from './supabase'

export async function prepareSuperadminLogin(email, password) {
  const res = await fetch('/api/auth/superadmin-bootstrap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (res.status === 204) return
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(payload.error || 'Could not prepare superadmin login')
  }
}

export async function signInAdmin(email, password) {
  await prepareSuperadminLogin(email, password)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(error.message)
}

export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session))
  return data.subscription
}

/**
 * Resolve the plaza for a plaza-admin user.
 * Superadmin provisions plazas with owner_id already set.
 */
export async function ensureComplex(user) {
  const { data: existing, error: fetchError } = await supabase
    .from('complexes')
    .select('*')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (fetchError) throw new Error(fetchError.message)
  if (existing) return existing

  throw new Error(
    'No plaza is assigned to this account. Ask a superadmin to create a plaza for your login.',
  )
}
