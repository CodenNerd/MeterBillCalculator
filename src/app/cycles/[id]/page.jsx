import { formatNaira } from '../../../utils/billing'
import { siteUrl } from '../../../lib/env'
import {
  fetchPublicCycleServer,
  fetchCycleDetailServer,
} from '../../../lib/serverSupabase'
import CycleDetailClient from './CycleDetailClient'

export async function generateMetadata({ params }) {
  const cycle = await fetchPublicCycleServer(params.id)
  if (!cycle) {
    return {
      title: 'Billing cycle',
      description: 'Shared electricity bills',
    }
  }

  const name = cycle.name || 'Billing cycle'
  const date = new Date(cycle.cycle_date).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
  const office = formatNaira(Number(cycle.actual_bill) || 0)
  const offset = formatNaira(Math.abs(Number(cycle.line_loss) || 0))
  const offsetLabel = Number(cycle.line_loss) >= 0 ? 'Offset' : 'Surplus'
  const description = `${date} · Office ${office} · ${offsetLabel} ${offset}`

  return {
    title: name,
    description,
    openGraph: {
      title: name,
      description,
      type: 'website',
      url: `${siteUrl()}/cycles/${params.id}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: name,
      description,
    },
  }
}

export default function CycleDetailPage() {
  return <CycleDetailClient />
}
