import { createClient } from '@supabase/supabase-js'
import { getSupabaseUrl, getSupabasePublishableKey } from './env'

/**
 * Server-side Supabase client for metadata / OG image generation.
 */
export function createServerSupabase() {
  const url = getSupabaseUrl()
  const key = getSupabasePublishableKey()
  if (!url || !key || url.includes('your-project-id')) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function fetchPublicCycleServer(cycleId) {
  const client = createServerSupabase()
  if (!client) return null

  const { data: cycle, error } = await client
    .from('billing_cycles')
    .select('*')
    .eq('id', cycleId)
    .maybeSingle()

  if (error || !cycle) return null
  if (cycle.status && cycle.status !== 'published' && cycle.status !== 'concluded') {
    return null
  }
  return cycle
}

export async function fetchCycleDetailServer(cycleId) {
  const client = createServerSupabase()
  if (!client) return []

  const { data, error } = await client
    .from('cycle_business_bills')
    .select('*')
    .eq('cycle_id', cycleId)
    .order('final_amount', { ascending: false })

  if (error) return []
  return data || []
}

export async function fetchPlazaBySlugServer(slug) {
  const client = createServerSupabase()
  if (!client || !slug) return null

  const { data, error } = await client
    .from('complexes')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error || !data) return null
  return data
}

export async function fetchPublicCycleForPlazaServer(cycleId, plazaSlug) {
  const plaza = await fetchPlazaBySlugServer(plazaSlug)
  if (!plaza) return null
  const cycle = await fetchPublicCycleServer(cycleId)
  if (!cycle) return null
  if (String(cycle.complex_id) !== String(plaza.id)) return null
  return { cycle, plaza }
}

/** Public invoice: plaza + business + cycle bill (published/concluded only). */
export async function fetchPublicInvoiceServer(plazaSlug, businessId, cycleId) {
  const plaza = await fetchPlazaBySlugServer(plazaSlug)
  if (!plaza) return null

  const client = createServerSupabase()
  if (!client) return null

  const { data: business, error: bizError } = await client
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .maybeSingle()

  if (bizError || !business) return null
  if (String(business.complex_id) !== String(plaza.id)) return null

  const { data: bill, error: billError } = await client
    .from('cycle_business_bills')
    .select('*')
    .eq('business_id', businessId)
    .eq('cycle_id', cycleId)
    .maybeSingle()

  if (billError || !bill) return null
  if (String(bill.complex_id) !== String(plaza.id)) return null

  const cycle = await fetchPublicCycleServer(cycleId)
  if (!cycle) return null
  if (String(cycle.complex_id) !== String(plaza.id)) return null

  return { plaza, business, bill, cycle }
}
