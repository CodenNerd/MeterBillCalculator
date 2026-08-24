import { createClient } from '@supabase/supabase-js'
import { isLocalMode } from './localMode'
import { createLocalClient } from './localClient'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = isLocalMode()
  ? createLocalClient()
  : createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/**
 * Fetch all businesses for one complex, with their previous readings.
 * Returns: [{ id, name, email, previous_reading }]
 */
export async function fetchBusinesses(complexId) {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('complex_id', complexId)
    .order('id', { ascending: true })

  if (error) throw new Error(error.message)
  return data
}

/**
 * Add a new business to the DB. `id` is assigned by the database now
 * (not the app) so businesses across different complexes never collide.
 * @param {{ name: string, email?: string|null }} biz
 * @param {string} complexId
 */
export async function addBusiness(biz, complexId) {
  const { data, error } = await supabase
    .from('businesses')
    .insert({ name: biz.name, email: biz.email || null, previous_reading: 0, complex_id: complexId })
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
 * Called when a cycle is concluded.
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

function mapBillRows(cycleId, complexId, rows, evidenceByBusiness = {}) {
  return rows.map(r => {
    const evidence = evidenceByBusiness[r.id] || {}
    return {
      cycle_id: cycleId,
      complex_id: complexId,
      business_id: r.id,
      business_name: r.name,
      previous_reading: r.prev,
      current_reading: r.curr,
      units: r.units,
      unit_amount: r.unitAmount,
      misc: r.misc,
      misc_note: r.note || r.miscNote || null,
      line_loss_share: r.lineLossShare ?? 0,
      final_amount: r.finalAmount ?? (r.unitAmount + r.misc),
      evidence_note: evidence.note ?? null,
      evidence_file_id: evidence.fileId ?? null,
    }
  })
}

/**
 * Publish a draft (create) or update an existing published cycle.
 * Does not roll previous readings.
 *
 * @param {object} summary
 * @param {Array} rows - calculateBills/applyLineLoss rows
 * @param {string} complexId
 * @param {number|string|null} existingCycleId
 */
export async function publishCycle(summary, rows, complexId, existingCycleId = null) {
  const payload = {
    actual_bill: summary.actualBill,
    calculated_total: summary.calculatedUnitTotal,
    total_misc: summary.totalMisc,
    line_loss: summary.lineLoss,
    allocation_method: summary.allocationMethod || 'equal',
    complex_id: complexId,
    name: summary.name || null,
    cycle_date: summary.cycleDate || new Date().toISOString(),
    status: 'published',
  }

  let cycle
  if (existingCycleId) {
    const { error: updateError } = await supabase
      .from('billing_cycles')
      .update(payload)
      .eq('id', existingCycleId)

    if (updateError) throw new Error(updateError.message)

    const { error: delError } = await supabase
      .from('cycle_business_bills')
      .delete()
      .eq('cycle_id', existingCycleId)

    if (delError) throw new Error(delError.message)

    const { data: refreshed, error: fetchError } = await supabase
      .from('billing_cycles')
      .select('*')
      .eq('id', existingCycleId)
      .single()

    if (fetchError) throw new Error(fetchError.message)
    cycle = refreshed
  } else {
    const { data, error } = await supabase
      .from('billing_cycles')
      .insert(payload)
      .select()
      .single()

    if (error) throw new Error(error.message)
    cycle = data
  }

  const businessRows = mapBillRows(cycle.id, complexId, rows)
  const { error: rowsError } = await supabase
    .from('cycle_business_bills')
    .insert(businessRows)

  if (rowsError) throw new Error(rowsError.message)
  return cycle
}

/**
 * Conclude a published cycle: lock it, attach evidence metadata, roll readings.
 *
 * @param {number|string} cycleId
 * @param {string} complexId
 * @param {Array} rows - bill rows with id/curr for rolling readings
 * @param {{ [businessId: string]: { note?: string, fileId?: string } }} evidenceByBusiness
 */
export async function concludeCycle(cycleId, complexId, rows, evidenceByBusiness = {}) {
  const { error: updateError } = await supabase
    .from('billing_cycles')
    .update({ status: 'concluded' })
    .eq('id', cycleId)
    .eq('complex_id', complexId)

  if (updateError) throw new Error(updateError.message)

  // Refresh bill rows with evidence metadata
  const { error: delError } = await supabase
    .from('cycle_business_bills')
    .delete()
    .eq('cycle_id', cycleId)

  if (delError) throw new Error(delError.message)

  const businessRows = mapBillRows(cycleId, complexId, rows, evidenceByBusiness)
  const { error: rowsError } = await supabase
    .from('cycle_business_bills')
    .insert(businessRows)

  if (rowsError) throw new Error(rowsError.message)

  const readingUpdates = rows.map(r => ({
    id: r.id,
    previous_reading: r.curr,
    updated_at: new Date().toISOString(),
  }))
  await saveCycleReadings(readingUpdates)

  const { data: cycle, error: fetchError } = await supabase
    .from('billing_cycles')
    .select('*')
    .eq('id', cycleId)
    .single()

  if (fetchError) throw new Error(fetchError.message)
  return cycle
}

/** @deprecated Prefer publishCycle / concludeCycle */
export async function saveBillingCycle(summary, rows, complexId) {
  const cycle = await publishCycle(summary, rows, complexId, null)
  await concludeCycle(cycle.id, complexId, rows, {})
  return cycle
}

/**
 * Fetch past billing cycles for one complex, most recent first.
 */
export async function fetchCycleHistory(complexId) {
  const { data, error } = await supabase
    .from('billing_cycles')
    .select('*')
    .eq('complex_id', complexId)
    .order('cycle_date', { ascending: false })

  if (error) throw new Error(error.message)
  return data
}

export async function fetchPublishedCycles(complexId) {
  const all = await fetchCycleHistory(complexId)
  return all.filter(c => c.status === 'published')
}

export async function fetchConcludedCycles(complexId) {
  const all = await fetchCycleHistory(complexId)
  return all.filter(c => c.status === 'concluded' || !c.status)
}

/**
 * Fetch the per-business breakdown for one billing cycle.
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

/**
 * Fetch one billing cycle by id (scoped to a complex when provided).
 */
export async function fetchCycleById(cycleId, complexId) {
  let query = supabase
    .from('billing_cycles')
    .select('*')
    .eq('id', cycleId)

  if (complexId) query = query.eq('complex_id', complexId)

  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

/** Public fetch — any published/concluded cycle by id. */
export async function fetchPublicCycle(cycleId) {
  const cycle = await fetchCycleById(cycleId)
  if (!cycle) return null
  if (cycle.status && cycle.status !== 'published' && cycle.status !== 'concluded') {
    return null
  }
  return cycle
}

export async function fetchBusinessById(businessId) {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}

/**
 * Timeline of bills for one business across cycles.
 */
export async function fetchBusinessBillTimeline(businessId) {
  const { data: bills, error } = await supabase
    .from('cycle_business_bills')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const withCycles = await Promise.all(
    (bills || []).map(async bill => {
      const cycle = await fetchCycleById(bill.cycle_id)
      return { bill, cycle }
    }),
  )

  return withCycles.filter(item => item.cycle)
}
