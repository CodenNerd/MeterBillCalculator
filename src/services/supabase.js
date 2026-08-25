import { createClient } from '@supabase/supabase-js'
import { getSupabaseUrl, getSupabasePublishableKey, isSupabaseConfigured } from '../lib/env'

const SUPABASE_URL = getSupabaseUrl()
const SUPABASE_PUBLISHABLE_KEY = getSupabasePublishableKey()

export const supabaseConfigured = isSupabaseConfigured()

if (!supabaseConfigured) {
  console.warn(
    'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env, then restart npm run dev.',
  )
}

/** Placeholder client only when unset — real calls will fail until .env is filled. */
export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_PUBLISHABLE_KEY || 'placeholder-publishable-key',
)
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
 * Rename a business (typo fix). Does not touch previous_reading or past bill snapshots.
 * @param {number} id
 * @param {string} newName
 */
export async function renameBusiness(id, newName) {
  const trimmed = String(newName || '').trim()
  if (!trimmed) throw new Error('Business name is required')
  const { error } = await supabase
    .from('businesses')
    .update({ name: trimmed })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

/**
 * Replace the tenant occupying this shop: same business row and meter reading,
 * new live name. Past cycle_business_bills.business_name rows are left unchanged.
 * @param {number} id
 * @param {string} newName
 */
export async function replaceTenant(id, newName) {
  return renameBusiness(id, newName)
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
    .update({ previous_reading: value })
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
/**
 * Save current readings as the new previous readings for businesses.
 * Called when a cycle is concluded or a new worksheet is seeded from a published cycle.
 */
export async function saveCycleReadings(currentReadings) {
  const updates = Array.isArray(currentReadings)
    ? currentReadings.map(({ id, previous_reading }) => ({
        id,
        previous_reading: Number(previous_reading) || 0,
      }))
    : Object.entries(currentReadings).map(([id, value]) => ({
        id: Number.isFinite(Number(id)) ? Number(id) : id,
        previous_reading: parseFloat(value) || 0,
      }))

  // Prefer update over upsert: businesses.id is GENERATED ALWAYS, so upsert insert fails.
  for (const row of updates) {
    const { error } = await supabase
      .from('businesses')
      .update({ previous_reading: row.previous_reading })
      .eq('id', row.id)

    if (error) throw new Error(error.message)
  }
}

function mapBillRows(
  cycleId,
  complexId,
  rows,
  evidenceByBusiness = {},
  paymentMetaByBusiness = {},
) {
  return rows.map(r => {
    const evidence = evidenceByBusiness[r.id] || {}
    const meta = paymentMetaByBusiness[r.id] || {}
    const paymentStatus = evidence.paymentStatus
      || meta.paymentStatus
      || r.paymentStatus
      || 'awaiting'
    const amountPaid = evidence.amountPaid != null
      ? evidence.amountPaid
      : (meta.amountPaid != null ? meta.amountPaid : (r.amountPaid ?? null))
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
      evidence_note: evidence.note ?? meta.evidenceNote ?? null,
      evidence_file_id: evidence.fileId ?? meta.evidenceFileId ?? null,
      payment_status: paymentStatus,
      amount_paid: amountPaid,
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
  let paymentMetaByBusiness = {}
  let cycleId = existingCycleId

  if (cycleId) {
    const existingRows = await fetchCycleDetail(cycleId)
    paymentMetaByBusiness = Object.fromEntries(
      (existingRows || []).map(r => [r.business_id, {
        paymentStatus: r.payment_status || 'awaiting',
        amountPaid: r.amount_paid ?? null,
        evidenceNote: r.evidence_note ?? null,
        evidenceFileId: r.evidence_file_id ?? null,
      }]),
    )

    const { data: updated, error: updateError } = await supabase
      .from('billing_cycles')
      .update(payload)
      .eq('id', cycleId)
      .select()
      .maybeSingle()

    if (updateError) throw new Error(updateError.message)

    if (!updated) {
      // Stale localStorage id (e.g. from old demo) or RLS blocked the update.
      const { data: exists, error: existsError } = await supabase
        .from('billing_cycles')
        .select('id')
        .eq('id', cycleId)
        .maybeSingle()
      if (existsError) throw new Error(existsError.message)
      if (exists) {
        throw new Error(
          'Could not update this cycle. Sign in as the plaza admin (or superadmin) and try again.',
        )
      }
      // Cycle does not exist — create a new one instead of patching a ghost id.
      cycleId = null
      paymentMetaByBusiness = {}
    } else {
      cycle = updated

      const { error: delError } = await supabase
        .from('cycle_business_bills')
        .delete()
        .eq('cycle_id', cycle.id)

      if (delError) throw new Error(delError.message)
    }
  }

  if (!cycle) {
    const { data, error } = await supabase
      .from('billing_cycles')
      .insert(payload)
      .select()
      .single()

    if (error) throw new Error(error.message)
    cycle = data
  }

  const businessRows = mapBillRows(cycle.id, complexId, rows, {}, paymentMetaByBusiness)
  const { error: rowsError } = await supabase
    .from('cycle_business_bills')
    .insert(businessRows)

  if (rowsError) throw new Error(rowsError.message)
  return cycle
}

/**
 * Conclude a published cycle: lock it, attach evidence metadata, roll readings.
 * Requires every tenant bill to be paid or unpaid (not awaiting).
 *
 * @param {number|string} cycleId
 * @param {string} complexId
 * @param {Array} rows - bill rows with id/curr for rolling readings
 * @param {{ [businessId: string]: { note?: string, fileId?: string, paymentStatus?: string } }} evidenceByBusiness
 */
export async function concludeCycle(cycleId, complexId, rows, evidenceByBusiness = {}) {
  const existing = await fetchCycleDetail(cycleId)
  const statuses = rows.map(r => {
    const fromDialog = evidenceByBusiness[r.id]?.paymentStatus
    const fromDb = existing.find(b => String(b.business_id) === String(r.id))?.payment_status
    return fromDialog || fromDb || 'awaiting'
  })
  if (statuses.some(s => s === 'awaiting')) {
    throw new Error('Every tenant must be marked paid or didn’t pay before concluding.')
  }

  const { error: updateError } = await supabase
    .from('billing_cycles')
    .update({ status: 'concluded' })
    .eq('id', cycleId)
    .eq('complex_id', complexId)

  if (updateError) throw new Error(updateError.message)

  const { error: delError } = await supabase
    .from('cycle_business_bills')
    .delete()
    .eq('cycle_id', cycleId)

  if (delError) throw new Error(delError.message)

  const paymentMetaByBusiness = Object.fromEntries(
    rows.map(r => {
      const existingRow = existing.find(b => String(b.business_id) === String(r.id))
      const ev = evidenceByBusiness[r.id] || {}
      return [r.id, {
        paymentStatus: ev.paymentStatus || existingRow?.payment_status || 'unpaid',
        amountPaid: ev.amountPaid != null
          ? ev.amountPaid
          : (existingRow?.amount_paid ?? null),
        evidenceNote: existingRow?.evidence_note ?? null,
        evidenceFileId: existingRow?.evidence_file_id ?? null,
      }]
    }),
  )
  const businessRows = mapBillRows(cycleId, complexId, rows, evidenceByBusiness, paymentMetaByBusiness)
  const { error: rowsError } = await supabase
    .from('cycle_business_bills')
    .insert(businessRows)

  if (rowsError) throw new Error(rowsError.message)

  const readingUpdates = rows.map(r => ({
    id: r.id,
    previous_reading: r.curr,
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

/**
 * Set each business previous_reading to that cycle's current_reading.
 * Used when starting a new worksheet after a published cycle.
 */
export async function seedPreviousFromCycle(cycleId) {
  const rows = await fetchCycleDetail(cycleId)
  const updates = (rows || [])
    .filter(r => r.business_id != null)
    .map(r => ({
      id: r.business_id,
      previous_reading: Number(r.current_reading) || 0,
    }))
  if (updates.length) await saveCycleReadings(updates)
  return Object.fromEntries(updates.map(u => [String(u.id), u.previous_reading]))
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

export async function updateBillPaymentStatus(billId, status) {
  if (!['awaiting', 'paid', 'unpaid'].includes(status)) {
    throw new Error('Invalid payment status')
  }
  const { data, error } = await supabase
    .from('cycle_business_bills')
    .update({ payment_status: status })
    .eq('id', billId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function updateBillPaymentStatusByBusiness(cycleId, businessId, status) {
  if (!['awaiting', 'paid', 'unpaid'].includes(status)) {
    throw new Error('Invalid payment status')
  }
  const { data, error } = await supabase
    .from('cycle_business_bills')
    .update({ payment_status: status })
    .eq('cycle_id', cycleId)
    .eq('business_id', businessId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

/**
 * Mark or clear payment on a tenant bill (status, amount paid, optional evidence).
 */
export async function markBillPayment({
  cycleId,
  businessId,
  status,
  amountPaid = null,
  note = undefined,
  fileId = undefined,
}) {
  if (cycleId == null || businessId == null || businessId === '' || businessId === 'undefined') {
    throw new Error('cycleId and businessId are required to update payment.')
  }
  if (!['awaiting', 'paid', 'unpaid'].includes(status)) {
    throw new Error('Invalid payment status')
  }
  const payload = {
    payment_status: status,
    amount_paid: status === 'awaiting'
      ? null
      : (status === 'unpaid' ? 0 : (amountPaid == null ? null : Number(amountPaid))),
  }

  if (status === 'awaiting') {
    payload.evidence_note = null
    payload.evidence_file_id = null
  } else {
    if (note !== undefined) payload.evidence_note = note || null
    if (fileId !== undefined) payload.evidence_file_id = fileId || null
  }

  const { data, error } = await supabase
    .from('cycle_business_bills')
    .update(payload)
    .eq('cycle_id', cycleId)
    .eq('business_id', businessId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function fetchComplexSettings(complexId) {
  const { data, error } = await supabase
    .from('complexes')
    .select('id, name, bank_name, account_name, account_number, rate_per_unit, banner_text, banner_enabled')
    .eq('id', complexId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}

export async function saveComplexSettings(complexId, patch) {
  const payload = {
    bank_name: patch.bank_name || null,
    account_name: patch.account_name || null,
    account_number: patch.account_number || null,
    rate_per_unit: Number(patch.rate_per_unit) > 0 ? Number(patch.rate_per_unit) : 250,
    banner_text: patch.banner_text || null,
    banner_enabled: Boolean(patch.banner_enabled),
  }
  const { data, error } = await supabase
    .from('complexes')
    .update(payload)
    .eq('id', complexId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function fetchBusinessCycleBill(businessId, cycleId) {
  const { data: bill, error } = await supabase
    .from('cycle_business_bills')
    .select('*')
    .eq('business_id', businessId)
    .eq('cycle_id', cycleId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!bill) return null

  const cycle = await fetchCycleById(cycleId)
  return { bill, cycle }
}

export async function fetchPlazaBySlug(slug) {
  if (!slug) return null
  const { data, error } = await supabase
    .from('complexes')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}

export async function listPlazas() {
  const { data, error } = await supabase
    .from('complexes')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

/**
 * Superadmin: create a plaza and provision plaza-admin login (email + password)
 * via the service-role API.
 */
export async function createPlaza({ name, slug, ownerEmail, ownerPassword }) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('You must be signed in as superadmin to create a plaza.')
  }

  const res = await fetch('/api/superadmin/plazas', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ name, slug, ownerEmail, ownerPassword }),
  })

  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(payload.error || 'Could not create plaza')
  }
  return payload.plaza
}

/**
 * Superadmin: update plaza details and/or plaza admin credentials.
 * Omit ownerPassword to leave the password unchanged.
 */
export async function updatePlaza(plazaId, patch) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('You must be signed in as superadmin to update a plaza.')
  }

  const body = {}
  if (patch.name != null) body.name = patch.name
  if (patch.slug != null) body.slug = patch.slug
  if (patch.ownerEmail !== undefined || patch.owner_email !== undefined) {
    body.ownerEmail = patch.ownerEmail ?? patch.owner_email
  }
  if (patch.ownerPassword !== undefined || patch.owner_password !== undefined) {
    body.ownerPassword = patch.ownerPassword ?? patch.owner_password
  }

  const res = await fetch(`/api/superadmin/plazas/${plazaId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })

  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(payload.error || 'Could not update plaza')
  }
  return payload.plaza
}

/** Fetch cycle and ensure it belongs to the plaza identified by slug. */
export async function fetchPublicCycleForPlaza(cycleId, plazaSlug) {
  const plaza = await fetchPlazaBySlug(plazaSlug)
  if (!plaza) return null
  const cycle = await fetchCycleById(cycleId)
  if (!cycle) return null
  if (cycle.status && cycle.status !== 'published' && cycle.status !== 'concluded') {
    return null
  }
  if (String(cycle.complex_id) !== String(plaza.id)) return null
  return { cycle, plaza }
}
