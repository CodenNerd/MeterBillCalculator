'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import CycleWorksheetView from '../../../../../components/CycleWorksheetView'
import GuestWorksheetSandbox from '../../../../../components/GuestWorksheetSandbox'
import Header from '../../../../../components/Header'
import { AdminGate, useBilling } from '../../../../../components/providers/BillingProvider'
import { navigate } from '../../../../../utils/navigation'

function PublishedWorksheetInner() {
  const params = useParams()
  const cycleId = params.id
  const b = useBilling()
  const [hydrated, setHydrated] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!cycleId || !b.complex?.id) return undefined
    let cancelled = false
    setHydrated(false)
    setError(null)
    ;(async () => {
      try {
        const cycle = await b.hydrateFromCycle(cycleId)
        if (cancelled) return
        if (!cycle || cycle.status === 'concluded') return
        setHydrated(true)
      } catch {
        if (!cancelled) setError('Could not open worksheet')
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleId, b.complex?.id])

  if (error) {
    return (
      <div className="status-screen">
        <p className="error-text">{error}</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate(b.href(`/cycles/${cycleId}`))}
        >
          Back to cycle
        </button>
      </div>
    )
  }

  if (!hydrated) {
    return (
      <div className="status-screen">
        <div className="spinner" />
        <p>Loading worksheet...</p>
      </div>
    )
  }

  return <CycleWorksheetView />
}

export default function PublishedWorksheetPage() {
  const params = useParams()
  const { session, ready } = useBilling()

  if (!ready) {
    return (
      <div className="app">
        <Header />
        <div className="status-screen">
          <div className="spinner" />
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <GuestWorksheetSandbox
        plazaSlug={params.plazaSlug}
        cycleId={params.id}
      />
    )
  }

  return (
    <AdminGate showHome>
      <PublishedWorksheetInner />
    </AdminGate>
  )
}
