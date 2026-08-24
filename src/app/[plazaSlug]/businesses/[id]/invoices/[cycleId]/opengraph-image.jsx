import { ImageResponse } from 'next/og'
import { screenshotOgFrame, ogPngResponse } from '../../../../../../lib/ogScreenshot'
import { fetchPublicInvoiceServer } from '../../../../../../lib/serverSupabase'
import { tenantNameForBill } from '../../../../../../utils/billing'

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
          <div style={{ fontSize: 36, marginTop: 28, fontFamily: 'monospace' }}>{detail}</div>
        )}
      </div>
    ),
    { ...size },
  )
}

export default async function Image({ params }) {
  const framePath = `/${params.plazaSlug}/businesses/${params.id}/invoices/${params.cycleId}/og-frame`

  try {
    const png = await screenshotOgFrame(framePath)
    return ogPngResponse(png)
  } catch (err) {
    console.error('[og] invoice screenshot failed:', err?.message || err)
  }

  const data = await fetchPublicInvoiceServer(
    params.plazaSlug,
    params.id,
    params.cycleId,
  )

  if (!data) {
    return fallbackImage({
      title: 'Invoice',
      subtitle: 'PlazaBills',
    })
  }

  const { business, bill, cycle, plaza } = data
  return fallbackImage({
    title: tenantNameForBill(bill, business),
    subtitle: `${plaza?.name || params.plazaSlug} · ${cycle?.name || 'Billing cycle'}`,
    detail: naira(bill.final_amount),
  })
}
