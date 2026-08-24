import { siteUrl } from '../lib/env'

// Unicode-safe base64 encode/decode so the ₦ symbol and business names
// with accents survive the round trip through a URL.
export function encodePayload(obj) {
  const json = JSON.stringify(obj)
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  bytes.forEach(b => { binary += String.fromCharCode(b) })
  return btoa(binary)
}

export function decodePayload(str) {
  const binary = atob(str)
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
  const json = new TextDecoder().decode(bytes)
  return JSON.parse(json)
}

/**
 * Build a self-contained snapshot of a whole cycle's bills table
 * for public sharing (no auth required).
 */
export function buildCycleTablePayload(result, ctx = {}) {
  const hasLineLoss = result.lineLoss !== undefined
  return {
    version: 1,
    cycleDate: ctx.cycleDate || new Date().toLocaleDateString('en-NG', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    }),
    complexName: ctx.complexName || null,
    ratePerUnit: ctx.ratePerUnit,
    allocationMethod: result.allocationMethod || null,
    hasLineLoss,
    actualBill: hasLineLoss ? result.actualBill : null,
    calculatedUnitTotal: hasLineLoss ? result.calculatedUnitTotal : null,
    lineLoss: hasLineLoss ? result.lineLoss : null,
    totalUnits: result.totalUnits,
    totalMisc: result.totalMisc,
    totalAmount: hasLineLoss ? result.totalFinalAmount : result.totalAmount,
    rows: result.rows.map(row => ({
      id: row.id,
      name: row.name,
      prev: row.prev,
      curr: row.curr,
      units: row.units,
      unitAmount: row.unitAmount,
      misc: row.misc,
      note: row.note || '',
      lineLossShare: row.lineLossShare ?? 0,
      amount: row.amount,
      finalAmount: hasLineLoss ? row.finalAmount : row.amount,
    })),
  }
}

/** Map a saved cycle + detail rows into the shape ResultsTable expects. */
export function resultFromSavedCycle(cycle, detailRows) {
  const rows = detailRows.map(r => ({
    id: r.business_id,
    name: r.business_name,
    prev: Number(r.previous_reading),
    curr: Number(r.current_reading),
    units: Number(r.units),
    unitAmount: Number(r.unit_amount),
    misc: Number(r.misc),
    note: r.misc_note || '',
    amount: Number(r.unit_amount) + Number(r.misc),
    lineLossShare: Number(r.line_loss_share),
    finalAmount: Number(r.final_amount),
  }))

  const totalUnits = rows.reduce((s, r) => s + r.units, 0)
  const totalMisc = Number(cycle.total_misc) || rows.reduce((s, r) => s + r.misc, 0)
  const calculatedUnitTotal = Number(cycle.calculated_total)
  const lineLoss = Number(cycle.line_loss)
  const hasLineLoss = true

  return {
    rows,
    totalUnits: +totalUnits.toFixed(2),
    totalMisc: +totalMisc.toFixed(2),
    totalAmount: +(calculatedUnitTotal + totalMisc).toFixed(2),
    actualBill: Number(cycle.actual_bill),
    calculatedUnitTotal,
    lineLoss,
    allocationMethod: cycle.allocation_method || 'equal',
    totalFinalAmount: rows.reduce((s, r) => s + r.finalAmount, 0),
    hasLineLoss,
  }
}

function originBase() {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return siteUrl()
}

/** Legacy encoded snapshot share (fallback). */
export function buildShareUrl(payload, route = 'bills') {
  const encoded = encodePayload(payload)
  return `${originBase()}/${route}?d=${encoded}`
}

/** Stable share link for a published/concluded cycle (path-based for OG). */
export function buildCycleShareUrl(cycleId) {
  return `${originBase()}/cycles/${cycleId}`
}

/**
 * Open WhatsApp with a prefilled message so the user can pick a chat.
 * Uses wa.me which works on mobile (app) and desktop (WhatsApp Web).
 */
export function openWhatsAppShare(url, title = 'Electricity bills') {
  const text = `${title}\n${url}`
  const href = `https://wa.me/?text=${encodeURIComponent(text)}`
  window.open(href, '_blank', 'noopener,noreferrer')
}

/**
 * Try the native share sheet first (great on mobile); fall back to
 * copying the link to the clipboard.
 * @returns {'shared'|'copied'|'cancelled'|'failed'}
 */
export async function shareOrCopyLink(url, title) {
  if (navigator.share) {
    try {
      await navigator.share({ title, url })
      return 'shared'
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelled'
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch {
    return 'failed'
  }
}
