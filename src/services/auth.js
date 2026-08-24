import { supabase } from './supabase'
import { isLocalMode } from './localMode'
import { startLocalDemo as startDemo } from './localClient'

export { isLocalMode }

export async function startLocalDemo() {
  if (!isLocalMode()) throw new Error('Local demo is only available without Supabase.')
  return startDemo()
}

export async function signUpAdmin(email, password, complexName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { role: 'admin', complex_name: complexName } },
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
 * Make sure the signed-in admin has a complex row. Creates one the first
 * time they log in after confirming their email — signUp can't write to
 * the DB straight away because there's no session until the email is
 * confirmed, so the complex gets created on the first real sign-in instead.
 */
export async function ensureComplex(user) {
  const { data: existing, error: fetchError } = await supabase
    .from('complexes')
    .select('*')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (fetchError) throw new Error(fetchError.message)
  if (existing) return existing

  const name = user.user_metadata?.complex_name || 'My Complex'
  const { data: created, error: insertError } = await supabase
    .from('complexes')
    .insert({ owner_id: user.id, name })
    .select()
    .single()

  if (insertError) throw new Error(insertError.message)
  return created
}
