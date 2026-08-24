import { createClient } from '@supabase/supabase-js'
import { isLocalMode } from '../services/localMode'
import { env } from './env'

/**
 * Server-side Supabase client for metadata / OG image generation.
 * Returns null in local stub mode (no real DB for crawlers).
 */
export function createServerSupabase() {
  if (isLocalMode()) return null
  const url = env('NEXT_PUBLIC_SUPABASE_URL')
  const key = env('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (!url || !key) return null
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
