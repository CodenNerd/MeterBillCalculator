import { fetchPublicInvoiceServer } from '../../../../../../../lib/serverSupabase'
import InvoiceCard from '../../../../../../../components/InvoiceCard'

export const metadata = {
  robots: { index: false, follow: false },
}

export default async function InvoiceOgFramePage({ params }) {
  const data = await fetchPublicInvoiceServer(
    params.plazaSlug,
    params.id,
    params.cycleId,
  )

  if (!data) {
    return (
      <div id="og-root" className="og-root og-root--empty">
        <p className="page-title">PlazaBills</p>
        <p className="muted">Invoice unavailable</p>
      </div>
    )
  }

  const { plaza, business, bill, cycle } = data

  return (
    <div className="og-frame-page">
      <div id="og-root" className="og-root og-root--invoice">
        <div className="og-frame-header">
          <span className="wordmark">
            Plaza<span className="wordmark-calc">Bills</span>
          </span>
          {plaza?.name && <span className="complex-label">{plaza.name}</span>}
        </div>
        <InvoiceCard
          business={business}
          bill={bill}
          cycle={cycle}
          settings={plaza}
          ogMode
          onBack={() => {}}
        />
      </div>
    </div>
  )
}
