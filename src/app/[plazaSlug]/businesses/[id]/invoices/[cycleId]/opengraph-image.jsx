import { ImageResponse } from 'next/og'
import { fetchPublicInvoiceServer } from '../../../../../../lib/serverSupabase'
import { RATE_PER_UNIT } from '../../../../../../utils/billing'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const revalidate = 60

function naira(n) {
  const v = Number(n) || 0
  return '₦' + v.toLocaleString('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

function kwh(n) {
  return `${Number(n || 0).toFixed(2)} kWh`
}

function statusLabel(status, cycleStatus) {
  if (status === 'paid') {
    return cycleStatus === 'published' ? 'Paid (cycle still open)' : 'Paid'
  }
  if (status === 'unpaid') return "Didn't pay"
  if (cycleStatus === 'published') return 'Active · Awaiting payment'
  return 'Awaiting payment'
}

function statusColors(status) {
  if (status === 'paid') return { bg: '#d8eee4', fg: '#0a5a41' }
  if (status === 'unpaid') return { bg: '#fde8e8', fg: '#b42318' }
  return { bg: '#fef3c7', fg: '#b45309' }
}

export default async function Image({ params }) {
  const data = await fetchPublicInvoiceServer(params.plazaSlug, params.id, params.cycleId)

  if (!data) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: 64,
            background: '#eef1ef',
            color: '#14231c',
            fontFamily: 'Georgia, serif',
          }}
        >
          <div style={{ fontSize: 56, fontWeight: 600 }}>MeterCalc</div>
          <div style={{ fontSize: 26, marginTop: 12, color: '#6b7c72' }}>Invoice</div>
        </div>
      ),
      { ...size },
    )
  }

  const { business, bill, cycle, plaza } = data
  const tenant = business.name || bill.business_name || 'Tenant'
  const status = bill.payment_status || 'awaiting'
  const badge = statusColors(status)
  const energy = Number(bill.unit_amount) || 0
  const misc = Number(bill.misc) || 0
  const share = Number(bill.line_loss_share) || 0
  const finalAmount = Number(bill.final_amount) || energy + misc + share
  const units = Number(bill.units) || 0
  const prev = Number(bill.previous_reading) || 0
  const curr = Number(bill.current_reading) || 0
  const rate = Number(plaza.rate_per_unit) > 0 ? Number(plaza.rate_per_unit) : RATE_PER_UNIT
  const date = cycle.cycle_date
    ? new Date(cycle.cycle_date).toLocaleDateString('en-NG', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : ''

  const rows = [
    { label: 'Previous reading', value: kwh(prev) },
    { label: 'Current reading', value: kwh(curr) },
    { label: 'Units used', value: kwh(units), hint: 'current − previous' },
    { label: 'Energy', value: naira(energy), hint: `${units.toFixed(2)} × ₦${rate}` },
    { label: 'Misc', value: naira(misc), hint: bill.misc_note || null },
    {
      label: 'Offset share',
      value: `${share >= 0 ? '+' : '−'}${naira(Math.abs(share))}`,
      hint: 'share of office − meter gap',
    },
  ]

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#eef1ef',
          padding: 36,
          fontFamily: 'system-ui, sans-serif',
          color: '#14231c',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            background: '#ffffff',
            border: '1px solid #d5ddd7',
            borderRadius: 16,
            padding: '28px 32px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div
                style={{
                  display: 'flex',
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#0b6e4f',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                Invoice
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: 40,
                  fontWeight: 700,
                  marginTop: 6,
                  fontFamily: 'Georgia, serif',
                }}
              >
                {tenant}
              </div>
              <div style={{ display: 'flex', fontSize: 20, color: '#6b7c72', marginTop: 6 }}>
                {plaza.name || params.plazaSlug}
                {' · '}
                {cycle.name || 'Billing cycle'}
                {date ? ` · ${date}` : ''}
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                background: badge.bg,
                color: badge.fg,
                fontSize: 16,
                fontWeight: 700,
                padding: '8px 14px',
                borderRadius: 8,
              }}
            >
              {statusLabel(status, cycle.status)}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginTop: 22,
              padding: '18px 22px',
              background: '#14231c',
              color: '#f3f7f4',
              borderRadius: 10,
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: 14,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 1,
                opacity: 0.75,
              }}
            >
              Amount due
            </div>
            <div style={{ display: 'flex', fontSize: 36, fontWeight: 700 }}>
              {naira(finalAmount)}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              marginTop: 20,
              flex: 1,
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: 18,
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              Breakdown
            </div>
            {rows.map((row) => (
              <div
                key={row.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: '1px solid #e8eee9',
                  fontSize: 20,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', color: '#6b7c72', fontSize: 15 }}>{row.label}</div>
                  {row.hint && (
                    <div style={{ display: 'flex', color: '#9aab9f', fontSize: 13, marginTop: 2 }}>
                      {row.hint}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', fontWeight: 600, fontFamily: 'ui-monospace, monospace' }}>
                  {row.value}
                </div>
              </div>
            ))}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: 12,
                fontSize: 22,
                fontWeight: 700,
              }}
            >
              <div style={{ display: 'flex' }}>Final</div>
              <div style={{ display: 'flex', color: '#0a5a41', fontFamily: 'ui-monospace, monospace' }}>
                {naira(finalAmount)}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
