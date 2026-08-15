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
 * Build the self-contained payload for one business's bill.
 * Works for a saved cycle OR a draft that hasn't been saved yet —
 * everything the bill page needs is embedded in the link itself.
 */
export function buildBillPayload(row, ctx) {
  return {
    businessId: row.id,
    businessName: row.name,
    prev: row.prev,
    curr: row.curr,
    units: row.units,
    ratePerUnit: ctx.ratePerUnit,
    unitAmount: row.unitAmount,
    misc: row.misc,
    hasLineLoss: !!ctx.hasLineLoss,
    lineLossShare: row.lineLossShare ?? 0,
    finalAmount: ctx.hasLineLoss ? row.finalAmount : row.amount,
    cycleDate: ctx.cycleDate,
  }
}

export function buildShareUrl(payload) {
  const encoded = encodePayload(payload)
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}#/bill?d=${encoded}`
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
      // fall through to clipboard for any other error
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch {
    return 'failed'
  }
}
