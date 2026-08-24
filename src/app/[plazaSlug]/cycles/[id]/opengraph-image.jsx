import { ImageResponse } from 'next/og'
import { screenshotOgFrame, ogPngResponse } from '../../../../lib/ogScreenshot'
import {
  fetchPublicCycleForPlazaServer,
  fetchCycleDetailServer,
} from '../../../../lib/serverSupabase'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const revalidate = 60
export const maxDuration = 30

function naira(n) {
  const v = Number(n) || 0
  return '₦' + v.toLocaleString('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

function fallbackImage({ title, subtitle, detail }) {
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
        <div style={{ fontSize: 28, color: '#0b6e4f', fontWeight: 600 }}>PlazaBills</div>
        <div style={{ fontSize: 52, fontWeight: 600, marginTop: 12 }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 26, marginTop: 16, color: '#6b7c72' }}>{subtitle}</div>
        )}
        {detail && (
          <div style={{ fontSize: 32, marginTop: 28, fontFamily: 'monospace' }}>{detail}</div>
        )}
      </div>
    ),
    { ...size },
  )
}

export default async function Image({ params }) {
  const framePath = `/${params.plazaSlug}/cycles/${params.id}/og-frame`

  try {
    const png = await screenshotOgFrame(framePath)
    return ogPngResponse(png)
  } catch (err) {
    console.error('[og] cycle screenshot failed:', err?.message || err)
  }

  const pair = await fetchPublicCycleForPlazaServer(params.id, params.plazaSlug)
  if (!pair?.cycle) {
    return fallbackImage({
      title: 'PlazaBills',
      subtitle: 'Electricity billing',
    })
  }

  const { cycle, plaza } = pair
  const rows = await fetchCycleDetailServer(params.id)
  const office = naira(cycle.actual_bill)
  const top = rows[0]

  return fallbackImage({
    title: cycle.name || 'Billing cycle',
    subtitle: `${plaza?.name || params.plazaSlug} · NEPA ${office}`,
    detail: top
      ? `${top.business_name}: ${naira(top.final_amount)}`
      : undefined,
  })
}
