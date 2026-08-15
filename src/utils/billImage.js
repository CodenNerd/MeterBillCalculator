import { formatNaira } from './billing'

const COLORS = {
  navy: '#0f1b2d',
  navySurface: '#1e2d45',
  navyBorder: '#2a3f5f',
  amber: '#f59e0b',
  white: '#f8fafc',
  muted: '#94a3b8',
}

function buildLineItems(payload) {
  const items = [
    ['Previous Reading', `${payload.prev.toFixed(2)} kWh`],
    ['Current Reading', `${payload.curr.toFixed(2)} kWh`],
    ['Units Consumed', `${payload.units.toFixed(2)} kWh`],
    ['Rate per Unit', formatNaira(payload.ratePerUnit)],
    ['Unit Charge', formatNaira(payload.unitAmount)],
  ]
  if (payload.misc > 0) {
    items.push(['Miscellaneous Bill', formatNaira(payload.misc)])
  }
  if (payload.hasLineLoss && payload.lineLossShare !== 0) {
    items.push([
      payload.lineLossShare >= 0 ? 'Shared Line Loss' : 'Shared Surplus',
      `${payload.lineLossShare >= 0 ? '+' : '\u2212'}${formatNaira(Math.abs(payload.lineLossShare))}`,
    ])
  }
  return items
}

/**
 * Draws the bill onto a <canvas>, matching the app's navy/amber theme,
 * so the exported image looks like it came straight off the results page.
 */
export function renderBillCanvas(payload) {
  const width = 640
  const padding = 40
  const lineItems = buildLineItems(payload)

  const rowHeight = 34
  const headerHeight = 150
  const totalHeight = 80
  const footerHeight = 50
  const height = headerHeight + lineItems.length * rowHeight + totalHeight + footerHeight

  const scale = 2 // export at 2x for a crisp image
  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)

  // page background
  ctx.fillStyle = COLORS.navy
  ctx.fillRect(0, 0, width, height)

  // card panel
  ctx.fillStyle = COLORS.navySurface
  ctx.fillRect(20, 20, width - 40, height - 40)
  ctx.strokeStyle = COLORS.navyBorder
  ctx.lineWidth = 1
  ctx.strokeRect(20.5, 20.5, width - 41, height - 41)

  let y = 60

  ctx.fillStyle = COLORS.amber
  ctx.font = '600 15px Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('\u26A1 MeterCalc', padding, y)

  ctx.fillStyle = COLORS.muted
  ctx.font = '12px Arial, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('Electricity Bill', width - padding, y)

  y += 36
  ctx.fillStyle = COLORS.white
  ctx.font = '700 24px Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(payload.businessName, padding, y)

  y += 22
  ctx.fillStyle = COLORS.muted
  ctx.font = '13px Arial, sans-serif'
  ctx.fillText(payload.cycleDate, padding, y)

  y += 20
  ctx.strokeStyle = COLORS.navyBorder
  ctx.beginPath()
  ctx.moveTo(padding, y)
  ctx.lineTo(width - padding, y)
  ctx.stroke()

  y += 30
  ctx.font = '13px Arial, sans-serif'
  for (const [label, value] of lineItems) {
    ctx.fillStyle = COLORS.muted
    ctx.textAlign = 'left'
    ctx.fillText(label, padding, y)
    ctx.fillStyle = COLORS.white
    ctx.textAlign = 'right'
    ctx.fillText(value, width - padding, y)
    y += rowHeight
  }

  y += 4
  ctx.strokeStyle = COLORS.navyBorder
  ctx.beginPath()
  ctx.moveTo(padding, y)
  ctx.lineTo(width - padding, y)
  ctx.stroke()

  y += 38
  ctx.fillStyle = COLORS.muted
  ctx.font = '13px Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('Total Amount Due', padding, y)
  ctx.fillStyle = COLORS.amber
  ctx.font = '700 26px Arial, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(formatNaira(payload.finalAmount), width - padding, y)

  y += 40
  ctx.fillStyle = COLORS.muted
  ctx.font = '11px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Generated via MeterCalc', width / 2, y)

  return canvas
}

export function downloadBillImage(payload) {
  const canvas = renderBillCanvas(payload)
  canvas.toBlob(blob => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${payload.businessName.replace(/\s+/g, '-').toLowerCase()}-bill.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 'image/png')
}
