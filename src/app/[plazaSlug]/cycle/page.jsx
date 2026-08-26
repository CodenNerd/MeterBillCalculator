'use client'

import { useEffect } from 'react'
import { AdminGate, useBilling } from '../../../components/providers/BillingProvider'
import { navigate } from '../../../utils/navigation'

/** Legacy /{plaza}/cycle → /worksheet or /cycles/:id/worksheet */
export default function LegacyCycleRedirectPage() {
  const { ready, activeCycleId, plazaSlug, href } = useBilling()

  useEffect(() => {
    if (!ready || !plazaSlug) return
    if (activeCycleId) {
      navigate(href(`/cycles/${activeCycleId}/worksheet`))
    } else {
      navigate(href('/worksheet'))
    }
  }, [ready, activeCycleId, plazaSlug, href])

  return (
    <AdminGate showHome>
      <div className="status-screen">
        <div className="spinner" />
        <p>Opening worksheet...</p>
      </div>
    </AdminGate>
  )
}
