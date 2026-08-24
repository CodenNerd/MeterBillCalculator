import { ImageResponse } from 'next/og'
import {
  fetchPublicCycleServer,
  fetchCycleDetailServer,
} from '../../../lib/serverSupabase'

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

export default async function Image({ params }) {
  const cycle = await fetchPublicCycleServer(params.id)
  const rows = cycle ? await fetchCycleDetailServer(params.id) : []

  if (!cycle) {
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
          <div style={{ fontSize: 64, fontWeight: 600 }}>MeterCalc</div>
          <div style={{ fontSize: 28, marginTop: 16, color: '#6b7c72' }}>
            Electricity billing
          </div>
        </div>
      ),
      { ...size },
    )
  }

  const name = cycle.name || 'Billing cycle'
  const date = new Date(cycle.cycle_date).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const topRows = [...rows]
    .sort((a, b) => Number(b.final_amount) - Number(a.final_amount))
    .slice(0, 5)
  const offset = Number(cycle.line_loss) || 0
  const offsetLabel = offset >= 0 ? 'Offset' : 'Surplus'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#eef1ef',
          color: '#14231c',
          padding: 48,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 22, color: '#0b6e4f', fontWeight: 700 }}>MeterCalc</div>
            <div style={{ fontSize: 44, fontWeight: 700, marginTop: 8, fontFamily: 'Georgia, serif' }}>
              {name}
            </div>
            <div style={{ fontSize: 22, color: '#6b7c72', marginTop: 6 }}>{date}</div>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: '#fff',
              border: '1px solid #d5ddd7',
              borderRadius: 12,
              padding: '16px 20px',
              minWidth: 220,
            }}
          >
            <div style={{ fontSize: 14, color: '#6b7c72', textTransform: 'uppercase', letterSpacing: 1 }}>
              Office bill
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, marginTop: 4 }}>
              {naira(cycle.actual_bill)}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, marginTop: 28 }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              background: '#fff',
              borderRadius: 12,
              border: '1px solid #d5ddd7',
              padding: '14px 18px',
            }}
          >
            <div style={{ fontSize: 13, color: '#6b7c72', textTransform: 'uppercase' }}>Meter total</div>
            <div style={{ fontSize: 26, fontWeight: 600, marginTop: 4 }}>
              {naira(cycle.calculated_total)}
            </div>
          </div>
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              background: '#fff',
              borderRadius: 12,
              border: '1px solid #d5ddd7',
              padding: '14px 18px',
            }}
          >
            <div style={{ fontSize: 13, color: '#6b7c72', textTransform: 'uppercase' }}>{offsetLabel}</div>
            <div style={{ fontSize: 26, fontWeight: 600, marginTop: 4, color: '#0a5a41' }}>
              {naira(Math.abs(offset))}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 28,
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #d5ddd7',
            overflow: 'hidden',
            flex: 1,
          }}
        >
          <div
            style={{
              display: 'flex',
              padding: '12px 20px',
              background: '#f7f9f7',
              borderBottom: '1px solid #d5ddd7',
              fontSize: 14,
              color: '#6b7c72',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            <div style={{ flex: 1 }}>Tenant</div>
            <div style={{ width: 160, textAlign: 'right' }}>Amount due</div>
          </div>
          {topRows.map((row) => (
            <div
              key={String(row.id || row.business_id)}
              style={{
                display: 'flex',
                padding: '14px 20px',
                borderBottom: '1px solid #d5ddd7',
                fontSize: 22,
              }}
            >
              <div style={{ flex: 1, fontWeight: 600 }}>{row.business_name}</div>
              <div style={{ width: 160, textAlign: 'right', fontWeight: 600, color: '#0a5a41' }}>
                {naira(row.final_amount)}
              </div>
            </div>
          ))}
          {topRows.length === 0 && (
            <div style={{ padding: 24, color: '#6b7c72', fontSize: 20 }}>No bill rows yet</div>
          )}
        </div>
      </div>
    ),
    { ...size },
  )
}
