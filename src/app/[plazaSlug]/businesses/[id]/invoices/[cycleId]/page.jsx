import { formatNaira, tenantNameForBill } from '../../../../../../utils/billing'
import { siteUrl } from '../../../../../../lib/env'
import { fetchPublicInvoiceServer } from '../../../../../../lib/serverSupabase'
import InvoicePageClient from './InvoicePageClient'

export async function generateMetadata({ params }) {
  const data = await fetchPublicInvoiceServer(params.plazaSlug, params.id, params.cycleId)
  if (!data) {
    return {
      title: 'Invoice',
      description: 'Tenant electricity invoice',
    }
  }

  const { business, bill, cycle, plaza } = data
  const name = tenantNameForBill(bill, business)
  const due = formatNaira(Number(bill.final_amount) || 0)
  const date = cycle.cycle_date
    ? new Date(cycle.cycle_date).toLocaleDateString('en-NG', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : ''
  const description = `${plaza.name || params.plazaSlug} · ${cycle.name || 'Billing cycle'} · ${date} · Due ${due}`

  return {
    title: `${name} · Invoice`,
    description,
    openGraph: {
      title: `${name} · Invoice`,
      description,
      type: 'website',
      url: `${siteUrl()}/${params.plazaSlug}/businesses/${params.id}/invoices/${params.cycleId}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} · Invoice`,
      description,
    },
  }
}

export default function InvoicePage() {
  return <InvoicePageClient />
}
