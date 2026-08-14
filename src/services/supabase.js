import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/**
 * Fetch all businesses with their previous readings from the DB.
 * Returns: [{ id, name, previous_reading }]
 */
export async function fetchBusinesses() {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .order('id', { ascending: true })

  if (error) throw new Error(error.message)
  return data
}

/**
 * Add a new business to the DB.
 * @param {{ id: number, name: string }} biz
 */
export async function addBusiness(biz) {
  const { data, error } = await supabase
    .from('businesses')
    .insert({ id: biz.id, name: biz.name, previous_reading: 0 })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

/**
 * Rename a business.
 * @param {number} id
 * @param {string} newName
 */
export async function renameBusiness(id, newName) {
  const { error } = await supabase
    .from('businesses')
    .update({ name: newName })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

/**
 * Manually set a business's previous (former cumulative) reading.
 * Used for onboarding an existing tenant whose starting reading isn't 0,
 * or for correcting a mistaken value outside the normal save-cycle flow.
 * @param {number} id
 * @param {number} value
 */
export async function updatePreviousReading(id, value) {
  const { error } = await supabase
    .from('businesses')
    .update({ previous_reading: value, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

/**
 * Remove a business from the DB.
 * @param {number} id
 */
export async function removeBusiness(id) {
  const { error } = await supabase
    .from('businesses')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}

/**
 * Save current readings as the new previous readings for all businesses.
 * Called at the end of each billing cycle.
 * @param {{ [id: number]: number } | Array<{ id: number, name: string, previous_reading: number }> } currentReadings
 */
export async function saveCycleReadings(currentReadings) {
  const updates = Array.isArray(currentReadings)
    ? currentReadings
    : Object.entries(currentReadings).map(([id, value]) => ({
        id: parseInt(id),
        previous_reading: parseFloat(value) || 0,
        updated_at: new Date().toISOString(),
      }))

  const { error } = await supabase
    .from('businesses')
    .upsert(updates, { onConflict: 'id' })

  if (error) throw new Error(error.message)
}
