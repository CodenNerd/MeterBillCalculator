import { supabase } from './supabase'

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

export async function signUpBusinessOwner(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { role: 'business' } },
  })
  if (error) throw new Error(error.message)
  return data
}

export async function signInBusinessOwner(email, password) {
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

/**
 * Link a business owner's new account to their pre-registered business row
 * (matched by email — the complex admin sets each business's email when
 * adding it, so this is what lets the right tenant claim the right row).
 */
export async function claimBusinessRow(user) {
  await supabase
    .from('businesses')
    .update({ owner_user_id: user.id })
    .eq('email', user.email)
    .is('owner_user_id', null)

  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_user_id', user.id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}

/**
 * A business owner's own bill history. No explicit filter needed —
 * row-level security only ever returns their own rows.
 */
export async function fetchMyBillHistory() {
  const { data, error } = await supabase
    .from('cycle_business_bills')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data
}
