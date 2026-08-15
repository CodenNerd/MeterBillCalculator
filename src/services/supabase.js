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

/**
 * Save a completed billing cycle: the electricity-office bill, the
 * meter-calculated total, the resulting line loss, and each business's
 * final breakdown for that cycle — so it can be looked back on later.
 *
 * @param {{ actualBill: number, calculatedUnitTotal: number, totalMisc: number, lineLoss: number }} summary
 * @param {Array<{ id: number, name: string, prev: number, curr: number, units: number, unitAmount: number, misc: number, lineLossShare: number, finalAmount: number }>} rows
 */
export async function saveBillingCycle(summary, rows) {
  const { data: cycle, error: cycleError } = await supabase
    .from('billing_cycles')
    .insert({
      actual_bill: summary.actualBill,
      calculated_total: summary.calculatedUnitTotal,
      total_misc: summary.totalMisc,
      line_loss: summary.lineLoss,
    })
    .select()
    .single()

  if (cycleError) throw new Error(cycleError.message)

  const businessRows = rows.map(r => ({
    cycle_id: cycle.id,
    business_id: r.id,
    business_name: r.name,
    previous_reading: r.prev,
    current_reading: r.curr,
    units: r.units,
    unit_amount: r.unitAmount,
    misc: r.misc,
    line_loss_share: r.lineLossShare ?? 0,
    final_amount: r.finalAmount ?? (r.unitAmount + r.misc),
  }))

  const { error: rowsError } = await supabase
    .from('cycle_business_bills')
    .insert(businessRows)

  if (rowsError) throw new Error(rowsError.message)

  return cycle
}

/**
 * Fetch past billing cycles, most recent first.
 */
export async function fetchCycleHistory() {
  const { data, error } = await supabase
    .from('billing_cycles')
    .select('*')
    .order('cycle_date', { ascending: false })

  if (error) throw new Error(error.message)
  return data
}

/**
 * Fetch the per-business breakdown for one billing cycle.
 * @param {number} cycleId
 */
export async function fetchCycleDetail(cycleId) {
  const { data, error } = await supabase
    .from('cycle_business_bills')
    .select('*')
    .eq('cycle_id', cycleId)
    .order('business_name', { ascending: true })

  if (error) throw new Error(error.message)
  return data
}
