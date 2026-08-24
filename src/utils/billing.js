export const RATE_PER_UNIT = 250 // ₦ per kWh (default; prefer complex settings)

export const ALLOCATION_EQUAL = 'equal'
export const ALLOCATION_PROPORTIONAL = 'proportional'

export const PAYMENT_AWAITING = 'awaiting'
export const PAYMENT_PAID = 'paid'
export const PAYMENT_UNPAID = 'unpaid'

export function calculateBills(businesses, previous, current, misc = {}, notes = {}, ratePerUnit = RATE_PER_UNIT) {
  const rate = Number(ratePerUnit) > 0 ? Number(ratePerUnit) : RATE_PER_UNIT
  let totalUnits = 0
  let totalMisc = 0
  let totalAmount = 0

  const rows = businesses.map(biz => {
    const prev = previous[biz.id] ?? 0
    const curr = parseFloat(current[biz.id]) || 0
    const units = Math.max(0, curr - prev)
    const unitAmount = units * rate
    const miscBill = Math.max(0, parseFloat(misc[biz.id]) || 0)
    const amount = unitAmount + miscBill
    const note = notes[biz.id] != null ? String(notes[biz.id]) : ''

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
 */
export function applyLineLoss(result, actualBill, method = ALLOCATION_EQUAL) {
  const { rows } = result
  const calculatedUnitTotal = rows.reduce((sum, r) => sum + r.unitAmount, 0)
  const lineLoss = actualBill - calculatedUnitTotal
  const n = rows.length

  if (n === 0) {
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

  const useProportional =
    method === ALLOCATION_PROPORTIONAL && calculatedUnitTotal > 0

  const rawShares = rows.map(row => {
    if (useProportional) {
      return lineLoss * (row.unitAmount / calculatedUnitTotal)
    }
    return lineLoss / n
  })

  const roundedShares = rawShares.map((s, i) =>
    i === n - 1 ? 0 : round2(s)
  )
  const allocated = roundedShares.slice(0, -1).reduce((sum, s) => sum + s, 0)
  roundedShares[n - 1] = round2(lineLoss - allocated)

  const updatedRows = rows.map((row, i) => {
    const lineLossShare = roundedShares[i]
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

export function computeCycleResult(
  businesses,
  previous,
  current,
  misc,
  actualBillInput,
  method,
  notes = {},
  ratePerUnit = RATE_PER_UNIT,
) {
  const base = calculateBills(businesses, previous, current, misc, notes, ratePerUnit)
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
