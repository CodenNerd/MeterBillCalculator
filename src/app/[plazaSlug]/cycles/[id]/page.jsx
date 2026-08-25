import { formatNaira } from '../../../../utils/billing'
import { siteUrl } from '../../../../lib/env'
import {
  fetchPublicCycleForPlazaServer,
  fetchCycleDetailServer,
} from '../../../../lib/serverSupabase'
import CycleDetailClient from './CycleDetailClient'

export async function generateMetadata({ params }) {
  const pair = await fetchPublicCycleForPlazaServer(params.id, params.plazaSlug)
  if (!pair?.cycle) {
    return {
      title: 'Billing cycle',
      description: 'Shared electricity bills',
    }
  }

  const { cycle, plaza } = pair
  const name = cycle.name || 'Billing cycle'
  const date = new Date(cycle.cycle_date).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
  const office = formatNaira(Number(cycle.actual_bill) || 0)
  const offset = formatNaira(Math.abs(Number(cycle.line_loss) || 0))
  const offsetLabel = Number(cycle.line_loss) >= 0 ? 'Offset' : 'Surplus'
  const description = `${plaza?.name || params.plazaSlug} · ${date} · NEPA office ${office} · ${offsetLabel} ${offset}`

  const ogImage = `${siteUrl()}/${params.plazaSlug}/cycles/${params.id}/opengraph-image?v=2`

  return {
    title: name,
    description,
    openGraph: {
      title: name,
      description,
      type: 'website',
      url: `${siteUrl()}/${params.plazaSlug}/cycles/${params.id}`,
      images: [{ url: ogImage, width: 1200, height: 630, alt: name }],
    },
    twitter: {
      card: 'summary_large_image',
      title: name,
      description,
      images: [ogImage],
    },
  }
}

export default function CycleDetailPage() {
  return <CycleDetailClient />
}
