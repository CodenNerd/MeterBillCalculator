import { ImageResponse } from 'next/og'
import {
  fetchPublicCycleForPlazaServer,
  fetchCycleDetailServer,
} from '../../../../lib/serverSupabase'

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
  return `${Number(n || 0).toFixed(1)} kWh`
}

function statusLabel(status) {
  if (status === 'published') return 'Published'
  if (status === 'concluded') return 'Concluded'
  return 'Shared'
}

function splitCaption(method) {
  return method === 'proportional' ? 'By usage' : 'Even split'
}

export default async function Image({ params }) {
  const pair = await fetchPublicCycleForPlazaServer(params.id, params.plazaSlug)
  const cycle = pair?.cycle
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
          <div style={{ fontSize: 64, fontWeight: 600 }}>PlazaBills</div>
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
    day: 'numeric', month: 'short', year: 'numeric',
  })
  const offset = Number(cycle.line_loss) || 0
  const offsetLabel = offset >= 0 ? 'Offset' : 'Surplus'
  const sorted = [...rows].sort(
    (a, b) => Number(b.final_amount) - Number(a.final_amount),
  )
  const topRows = sorted.slice(0, 4)
  const moreCount = Math.max(0, sorted.length - topRows.length)

  const card = {
    display: 'flex',
    flexDirection: 'column',
    background: '#ffffff',
    border: '1px solid #d5ddd7',
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
    flex: 1,
  }

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
          padding: 40,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            ...card,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Hero */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '28px 32px 22px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', fontSize: 20, fontWeight: 700, color: '#0b6e4f' }}>
                Meter<span style={{ color: '#14231c' }}>Calc</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: 16,
                  fontWeight: 600,
                  color: '#6b7c72',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                {statusLabel(cycle.status)}
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 40,
                fontWeight: 700,
                marginTop: 10,
                fontFamily: 'Georgia, serif',
                letterSpacing: '-0.02em',
              }}
            >
              {name}
            </div>
            <div style={{ display: 'flex', fontSize: 20, color: '#6b7c72', marginTop: 6 }}>
              {date} · {splitCaption(cycle.allocation_method)}
            </div>
          </div>

          {/* Figures strip — Meter total | Office bill | Offset */}
          <div
            style={{
              display: 'flex',
              borderTop: '1px solid #d5ddd7',
              borderBottom: '1px solid #d5ddd7',
            }}
          >
            {[
              { label: 'Meter total', value: naira(cycle.calculated_total), color: '#14231c' },
              { label: 'NEPA office bill', value: naira(cycle.actual_bill), color: '#14231c' },
              {
                label: offsetLabel,
                value: naira(Math.abs(offset)),
                color: offset >= 0 ? '#0a5a41' : '#b45309',
              },
            ].map((fig, i) => (
              <div
                key={fig.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  padding: '18px 28px',
                  borderRight: i < 2 ? '1px solid #d5ddd7' : 'none',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    fontSize: 14,
                    color: '#6b7c72',
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                    fontWeight: 600,
                  }}
                >
                  {fig.label}
                </div>
                <div
                  style={{
                    display: 'flex',
                    fontSize: 30,
                    fontWeight: 700,
                    marginTop: 6,
                    color: fig.color,
                  }}
                >
                  {fig.value}
                </div>
              </div>
            ))}
          </div>

          {/* Table */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
            }}
          >
            <div
              style={{
                display: 'flex',
                padding: '12px 28px',
                background: '#f7f9f7',
                borderBottom: '1px solid #d5ddd7',
                fontSize: 13,
                color: '#6b7c72',
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                fontWeight: 600,
              }}
            >
              <div style={{ display: 'flex', flex: 1.4 }}>Business</div>
              <div style={{ display: 'flex', width: 160, justifyContent: 'flex-end' }}>Units</div>
              <div style={{ display: 'flex', width: 180, justifyContent: 'flex-end' }}>Final</div>
            </div>

            {topRows.map((row, index) => (
              <div
                key={String(row.id || row.business_id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '14px 28px',
                  borderBottom: '1px solid #e8eee9',
                  background: index % 2 === 1 ? '#fbfcfb' : '#ffffff',
                  fontSize: 22,
                }}
              >
                <div style={{ display: 'flex', flex: 1.4, fontWeight: 600 }}>
                  {row.business_name}
                </div>
                <div
                  style={{
                    display: 'flex',
                    width: 160,
                    justifyContent: 'flex-end',
                    color: '#6b7c72',
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 20,
                  }}
                >
                  {kwh(row.units)}
                </div>
                <div
                  style={{
                    display: 'flex',
                    width: 180,
                    justifyContent: 'flex-end',
                    fontWeight: 700,
                    color: '#0a5a41',
                    fontFamily: 'ui-monospace, monospace',
                  }}
                >
                  {naira(row.final_amount)}
                </div>
              </div>
            ))}

            {topRows.length === 0 && (
              <div
                style={{
                  display: 'flex',
                  padding: 28,
                  color: '#6b7c72',
                  fontSize: 20,
                }}
              >
                No bill rows yet
              </div>
            )}

            {moreCount > 0 && (
              <div
                style={{
                  display: 'flex',
                  padding: '12px 28px',
                  color: '#6b7c72',
                  fontSize: 18,
                  fontWeight: 600,
                }}
              >
                +{moreCount} more tenant{moreCount === 1 ? '' : 's'}
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
