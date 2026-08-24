import { supabase } from './supabase'
import { isLocalMode } from './localMode'
import { startLocalDemo as startDemo, startLocalSuperadmin as startSuper } from './localClient'
import { slugifyPlazaName, isValidPlazaSlug } from '../utils/plaza'

export { isLocalMode }

export async function startLocalDemo() {
  if (!isLocalMode()) throw new Error('Local demo is only available without Supabase.')
  return startDemo()
}

export async function startLocalSuperadmin() {
  if (!isLocalMode()) throw new Error('Local demo is only available without Supabase.')
  return startSuper()
}

export async function signUpAdmin(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { role: 'admin' } },
  })
  if (error) throw new Error(error.message)
  return data
}

export async function signInAdmin(email, password) {
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
 * Does not auto-create plazas — superadmin provisions them.
 * Claims an invited plaza when owner_email matches.
 */
export async function ensureComplex(user) {
  const { data: existing, error: fetchError } = await supabase
    .from('complexes')
    .select('*')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (fetchError) throw new Error(fetchError.message)
  if (existing) {
    if (!existing.slug) {
      const slug = slugifyPlazaName(existing.name)
      const { data: patched } = await supabase
        .from('complexes')
        .update({ slug: isValidPlazaSlug(slug) ? slug : `plaza-${String(existing.id).slice(0, 8)}` })
        .eq('id', existing.id)
        .select()
        .single()
      return patched || existing
    }
    return existing
  }

  const email = (user.email || '').toLowerCase()
  if (email) {
    const { data: invited, error: inviteError } = await supabase
      .from('complexes')
      .select('*')
      .eq('owner_email', email)
      .is('owner_id', null)
      .maybeSingle()

    if (inviteError) throw new Error(inviteError.message)
    if (invited) {
      const { data: claimed, error: claimError } = await supabase
        .from('complexes')
        .update({ owner_id: user.id })
        .eq('id', invited.id)
        .select()
        .single()
      if (claimError) throw new Error(claimError.message)
      return claimed
    }
  }

  throw new Error(
    'No plaza is assigned to this account. Ask a superadmin to create a plaza for your email.',
  )
}
