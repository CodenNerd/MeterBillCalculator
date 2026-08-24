import {
  fetchPublicCycleForPlazaServer,
  fetchCycleDetailServer,
} from '../../../../../lib/serverSupabase'
import CycleOgFrame from '../../../../../components/CycleOgFrame'

export const metadata = {
  robots: { index: false, follow: false },
}

export default async function CycleOgFramePage({ params }) {
  const pair = await fetchPublicCycleForPlazaServer(params.id, params.plazaSlug)
  if (!pair?.cycle) {
    return (
      <div id="og-root" className="og-root og-root--empty">
        <p className="page-title">PlazaBills</p>
        <p className="muted">Cycle unavailable</p>
      </div>
    )
  }

  const rows = await fetchCycleDetailServer(params.id)

  return (
    <div className="og-frame-page">
      <CycleOgFrame plaza={pair.plaza} cycle={pair.cycle} rows={rows} />
    </div>
  )
}
