export const RATE_PER_UNIT = 250 // ₦ per kWh (default; prefer complex settings)

export const ALLOCATION_EQUAL = 'equal'
export const ALLOCATION_PROPORTIONAL = 'proportional'

export const PAYMENT_AWAITING = 'awaiting'
export const PAYMENT_PAID = 'paid'
export const PAYMENT_UNPAID = 'unpaid'

/** True when a per-business flag map has this id set (string/number keys). */
export function flagOn(map, id) {
  if (!map || id == null) return false
  return Boolean(map[id] || map[String(id)])
}

function cycleTimeMs(value) {
  if (value == null || value === '') return 0
  const t = new Date(value).getTime()
  return Number.isFinite(t) ? t : 0
}

/** Ascending cycle order: cycle_date → published_at → created_at → id. */
export function compareCyclesAsc(a, b) {
  const d = cycleTimeMs(a?.cycle_date) - cycleTimeMs(b?.cycle_date)
  if (d !== 0) return d
  const p = cycleTimeMs(a?.published_at) - cycleTimeMs(b?.published_at)
  if (p !== 0) return p
  const c = cycleTimeMs(a?.created_at) - cycleTimeMs(b?.created_at)
  if (c !== 0) return c
  return Number(a?.id || 0) - Number(b?.id || 0)
}

/**
 * Cycle immediately before `anchor` in plaza order.
 * `history` may be unsorted. Anchor may be an existing cycle or a draft date.
 */
export function findPrecedingCycle(history, anchor) {
  if (!anchor || !history?.length) return null
  const sorted = [...history].sort(compareCyclesAsc)
  if (anchor.id != null && anchor.id !== '') {
    const idx = sorted.findIndex(c => String(c.id) === String(anchor.id))
    if (idx > 0) return sorted[idx - 1]
    if (idx === 0) return null
  }
  let preceding = null
  for (const c of sorted) {
    if (compareCyclesAsc(c, anchor) < 0) preceding = c
    else break
  }
  return preceding
}

export function calculateBills(businesses, previous, current, misc = {}, notes = {}, ratePerUnit = RATE_PER_UNIT) {
  const rate = Number(ratePerUnit) > 0 ? Number(ratePerUnit) : RATE_PER_UNIT
  let totalUnits = 0
  let totalMisc = 0
  let totalAmount = 0

  const rows = businesses.map(biz => {
    const prev = previous[biz.id] ?? previous[String(biz.id)] ?? 0
    const curr = parseFloat(current[biz.id] ?? current[String(biz.id)]) || 0
    const units = Math.max(0, curr - prev)
    const unitAmount = units * rate
    const miscBill = Math.max(0, parseFloat(misc[biz.id] ?? misc[String(biz.id)]) || 0)
    const amount = unitAmount + miscBill
    const noteRaw = notes[biz.id] ?? notes[String(biz.id)]
    const note = noteRaw != null ? String(noteRaw) : ''

    totalUnits += units
    totalMisc += miscBill
    totalAmount += amount

    return {
      ...biz,
      prev,
      curr,
      units: +units.toFixed(2),
      misc: +miscBill.toFixed(2),
      note,
      unitAmount: +unitAmount.toFixed(2),
      amount: +amount.toFixed(2),
      ratePerUnit: rate,
    }
  })

  return {
    rows,
    totalUnits: +totalUnits.toFixed(2),
    totalMisc: +totalMisc.toFixed(2),
    totalAmount: +totalAmount.toFixed(2),
    ratePerUnit: rate,
  }
}

function round2(n) {
  return Math.round(n * 100) / 100
}

/**
 * Compare the calculated (meter-based) total against the actual bill from
 * the electricity office, and split the difference ("line loss") either
 * evenly or proportional to each business's energy charge.
 * Rows with excludeFromOffset get lineLossShare 0 and are left out of the split.
 */
export function applyLineLoss(result, actualBill, method = ALLOCATION_EQUAL) {
  const { rows } = result
  const calculatedUnitTotal = rows.reduce((sum, r) => sum + r.unitAmount, 0)
  const lineLoss = actualBill - calculatedUnitTotal

  if (rows.length === 0) {
    return {
      ...result,
      rows: [],
      actualBill: +actualBill.toFixed(2),
      calculatedUnitTotal: +calculatedUnitTotal.toFixed(2),
      lineLoss: +lineLoss.toFixed(2),
      allocationMethod: method,
      totalFinalAmount: 0,
    }
  }

  const participants = rows.filter(r => !r.excludeFromOffset)
  const participantUnitTotal = participants.reduce((sum, r) => sum + r.unitAmount, 0)
  const n = participants.length

  const useProportional =
    method === ALLOCATION_PROPORTIONAL && participantUnitTotal > 0

  const shareById = new Map()
  if (n === 0) {
    for (const row of rows) shareById.set(row.id, 0)
  } else {
    const rawShares = participants.map(row => {
      if (useProportional) {
        return lineLoss * (row.unitAmount / participantUnitTotal)
      }
      return lineLoss / n
    })

    const roundedShares = rawShares.map((s, i) =>
      i === n - 1 ? 0 : round2(s),
    )
    const allocated = roundedShares.slice(0, -1).reduce((sum, s) => sum + s, 0)
    roundedShares[n - 1] = round2(lineLoss - allocated)

    participants.forEach((row, i) => {
      shareById.set(row.id, roundedShares[i])
    })
    for (const row of rows) {
      if (!shareById.has(row.id)) shareById.set(row.id, 0)
    }
  }

  const updatedRows = rows.map(row => {
    const lineLossShare = shareById.get(row.id) ?? 0
    const finalAmount = round2(row.unitAmount + row.misc + lineLossShare)
    return {
      ...row,
      lineLossShare,
      finalAmount,
    }
  })

  const totalFinalAmount = updatedRows.reduce((sum, r) => sum + r.finalAmount, 0)

  return {
    ...result,
    rows: updatedRows,
    actualBill: +actualBill.toFixed(2),
    calculatedUnitTotal: +calculatedUnitTotal.toFixed(2),
    lineLoss: +lineLoss.toFixed(2),
    allocationMethod: useProportional ? ALLOCATION_PROPORTIONAL : ALLOCATION_EQUAL,
    totalFinalAmount: +totalFinalAmount.toFixed(2),
  }
}

/**
 * @param {object} [inclusion]
 * @param {Record<string|number, boolean>} [inclusion.excludeFromOffset]
 * @param {Record<string|number, boolean>} [inclusion.carryOver]
 */
export function computeCycleResult(
  businesses,
  previous,
  current,
  misc,
  actualBillInput,
  method,
  notes = {},
  ratePerUnit = RATE_PER_UNIT,
  inclusion = {},
) {
  const excludeFromOffset = inclusion.excludeFromOffset || {}
  const carryOver = inclusion.carryOver || {}

  const billed = (businesses || []).filter(b => !flagOn(carryOver, b.id))
  const base = calculateBills(billed, previous, current, misc, notes, ratePerUnit)
  base.rows = base.rows.map(row => ({
    ...row,
    excludeFromOffset: flagOn(excludeFromOffset, row.id),
  }))

  const parsed = parseFloat(actualBillInput)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return base
  }
  return applyLineLoss(base, parsed, method)
}

export function formatNaira(n) {
  return '₦' + Number(n || 0).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatKwh(n) {
  return `${Number(n).toFixed(2)} kWh`
}

/**
 * Name to show for a specific bill/cycle. Prefer the frozen snapshot so
 * replace-tenant handoffs never rewrite historical invoices.
 */
export function tenantNameForBill(bill, business) {
  const snap = bill?.business_name && String(bill.business_name).trim()
  if (snap) return snap
  const live = business?.name && String(business.name).trim()
  if (live) return live
  return 'Tenant'
}

export function paymentStatusLabel(status, cycleStatus) {
  if (status === PAYMENT_PAID) {
    return cycleStatus === 'published' ? 'Paid (cycle still open)' : 'Paid'
  }
  if (status === PAYMENT_UNPAID) return "Didn't pay"
  if (cycleStatus === 'published') return 'Active · Awaiting payment'
  return 'Awaiting payment'
}

export function defaultCycleName(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput)
  if (Number.isNaN(d.getTime())) {
    return new Date().toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })
  }
  return d.toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })
}

export function toDateInputValue(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput)
  if (Number.isNaN(d.getTime())) {
    return new Date().toISOString().slice(0, 10)
  }
  return d.toISOString().slice(0, 10)
}

export function isReadingValid(current, previous) {
  if (current === '' || current === undefined) return true
  return parseFloat(current) >= previous
}

export function hasDraftProgress(current, misc, actualBill, notes = {}) {
  const hasReading = Object.values(current || {}).some(v => v !== '' && v != null && String(v).length > 0)
  const hasMisc = Object.values(misc || {}).some(v => v !== '' && v != null && parseFloat(v) > 0)
  const hasNote = Object.values(notes || {}).some(v => v != null && String(v).trim().length > 0)
  const bill = parseFloat(actualBill)
  const hasBill = Number.isFinite(bill) && bill > 0
  return hasReading || hasMisc || hasNote || hasBill
}

export function defaultComplexSettings(partial = {}) {
  return {
    bank_name: partial.bank_name ?? '',
    account_name: partial.account_name ?? '',
    account_number: partial.account_number ?? '',
    rate_per_unit: Number(partial.rate_per_unit) > 0 ? Number(partial.rate_per_unit) : RATE_PER_UNIT,
    banner_text: partial.banner_text ?? '',
    banner_enabled: Boolean(partial.banner_enabled),
  }
}
